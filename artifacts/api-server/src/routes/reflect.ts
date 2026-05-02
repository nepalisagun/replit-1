import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, memories, agentEvents } from "@workspace/db";
import { desc, gte, sql } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

router.post("/reflect", async (req, res) => {
  const lookbackHours: number = req.body?.lookbackHours ?? 24;
  const maxMessages: number = req.body?.maxMessages ?? 100;

  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  const recentMessages = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(gte(messages.createdAt, since))
    .orderBy(messages.createdAt)
    .limit(maxMessages);

  if (recentMessages.length === 0) {
    res.json({
      messagesAnalyzed: 0,
      memoriesCreated: 0,
      memories: [],
      summary: "No recent messages found to reflect on.",
    });
    return;
  }

  const transcript = recentMessages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n\n");

  const prompt = `You are a reflection agent. Analyze this conversation transcript and extract valuable, concise memory items that should be stored for future reference.

TRANSCRIPT:
${transcript}

Extract memories in the following JSON format. Be selective — only extract genuinely useful, non-obvious insights. Aim for 3-8 memories total.

Return a JSON object with this exact structure:
{
  "memories": [
    {
      "type": "preference" | "fact" | "workflow" | "lesson",
      "owner": "user" | "agent",
      "content": "concise memory content (1-2 sentences max)",
      "importanceScore": 1-5,
      "category": "coding" | "ml" | "devops" | "planning" | "general" | "design" | "debugging"
    }
  ],
  "summary": "A 1-2 sentence summary of the key themes from this conversation."
}

Guidelines:
- "preference": user stated preferences (tools, approaches, styles)
- "fact": factual information learned (tech specs, system info, project details)
- "workflow": reusable processes or patterns identified
- "lesson": mistakes made, corrected misunderstandings, or key takeaways
- owner "user" = about the user, owner "agent" = agent behavior/capability
- importanceScore 5 = critical, 1 = low value
- Only extract what is genuinely useful for future conversations

Return ONLY valid JSON, no markdown, no explanation.`;

  let reflectionData: {
    memories: Array<{
      type: "preference" | "fact" | "workflow" | "lesson";
      owner: "agent" | "user";
      content: string;
      importanceScore: number;
      category: string;
    }>;
    summary: string;
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    const rawText = response.text ?? "{}";
    reflectionData = JSON.parse(rawText);

    if (!reflectionData.memories || !Array.isArray(reflectionData.memories)) {
      throw new Error("Invalid response structure");
    }
  } catch (err) {
    req.log.error({ err }, "Reflection AI call failed");

    await db.insert(agentEvents).values({
      eventType: "reflection",
      contextId: `reflect-${Date.now()}`,
      payload: `Reflection failed: ${err instanceof Error ? err.message : "unknown error"}`,
      status: "error",
    });

    res.status(500).json({ error: "Reflection job failed" });
    return;
  }

  const validTypes = ["preference", "fact", "workflow", "lesson"] as const;
  const validOwners = ["agent", "user"] as const;

  const validMemories = reflectionData.memories.filter(
    (m) =>
      validTypes.includes(m.type) &&
      validOwners.includes(m.owner) &&
      typeof m.content === "string" &&
      m.content.trim().length > 0 &&
      typeof m.importanceScore === "number" &&
      m.importanceScore >= 1 &&
      m.importanceScore <= 5
  );

  const inserted = validMemories.length > 0
    ? await db
        .insert(memories)
        .values(
          validMemories.map((m) => ({
            type: m.type,
            owner: m.owner,
            content: m.content.trim(),
            importanceScore: Math.round(m.importanceScore),
            category: m.category ?? "general",
          }))
        )
        .returning()
    : [];

  await db.insert(agentEvents).values({
    eventType: "reflection",
    contextId: `reflect-${Date.now()}`,
    payload: `Analyzed ${recentMessages.length} messages. Created ${inserted.length} memories. ${reflectionData.summary}`,
    status: "success",
  });

  res.json({
    messagesAnalyzed: recentMessages.length,
    memoriesCreated: inserted.length,
    memories: inserted.map((m) => ({
      id: m.id,
      owner: m.owner,
      type: m.type,
      content: m.content,
      importanceScore: m.importanceScore,
      category: m.category,
      createdAt: m.createdAt,
    })),
    summary: reflectionData.summary,
  });
});

export default router;
