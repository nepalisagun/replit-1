import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, agentSettings } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateGeminiConversationBody,
  RenameGeminiConversationBody,
  SendGeminiMessageBody,
  GetGeminiConversationParams,
  DeleteGeminiConversationParams,
  ListGeminiMessagesParams,
  SendGeminiMessageParams,
  GenerateGeminiImageBody,
} from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";
import { generateImage } from "@workspace/integrations-gemini-ai/image";
import { retrieveContext } from "./rag";

const router = Router();

router.get("/gemini/conversations", async (req, res) => {
  const convos = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.pinned), desc(conversations.createdAt));
  res.json(convos.map((c) => ({ id: c.id, title: c.title, pinned: c.pinned, archived: c.archived, createdAt: c.createdAt })));
});

router.post("/gemini/conversations", async (req, res) => {
  const parsed = CreateGeminiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [convo] = await db
    .insert(conversations)
    .values({ title: parsed.data.title })
    .returning();
  res.status(201).json({ id: convo.id, title: convo.title, pinned: convo.pinned, archived: convo.archived, createdAt: convo.createdAt });
});

router.get("/gemini/conversations/:id", async (req, res) => {
  const params = GetGeminiConversationParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [convo] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, params.data.id));
  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convo.id))
    .orderBy(messages.createdAt);
  res.json({
    id: convo.id,
    title: convo.title,
    createdAt: convo.createdAt,
    messages: msgs,
  });
});

router.patch("/gemini/conversations/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = RenameGeminiConversationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [existing] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db
    .update(conversations)
    .set({ title: parsed.data.title.trim() })
    .where(eq(conversations.id, id))
    .returning();
  res.json({ id: updated.id, title: updated.title, pinned: updated.pinned, archived: updated.archived, createdAt: updated.createdAt });
});

router.patch("/gemini/conversations/:id/pin", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db
    .update(conversations)
    .set({ pinned: !existing.pinned })
    .where(eq(conversations.id, id))
    .returning();
  res.json({ id: updated.id, title: updated.title, pinned: updated.pinned, archived: updated.archived, createdAt: updated.createdAt });
});

router.patch("/gemini/conversations/:id/archive", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db
    .update(conversations)
    .set({ archived: !existing.archived, pinned: existing.archived ? existing.pinned : false })
    .where(eq(conversations.id, id))
    .returning();
  res.json({ id: updated.id, title: updated.title, pinned: updated.pinned, archived: updated.archived, createdAt: updated.createdAt });
});

router.delete("/gemini/conversations/:id", async (req, res) => {
  const params = DeleteGeminiConversationParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db
    .delete(conversations)
    .where(eq(conversations.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.status(204).send();
});

router.get("/gemini/conversations/:id/messages", async (req, res) => {
  const params = ListGeminiMessagesParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(messages.createdAt);
  res.json(msgs);
});

router.post("/gemini/conversations/:id/messages", async (req, res) => {
  const params = SendGeminiMessageParams.safeParse({ id: req.params.id });
  const body = SendGeminiMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const conversationId = params.data.id;
  const [convo] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messages).values({
    conversationId,
    role: "user",
    content: body.data.content,
  });

  const chatHistory = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  // Retrieve semantic context via RAG
  let ragContext: Awaited<ReturnType<typeof retrieveContext>> = [];
  try {
    ragContext = await retrieveContext(body.data.content, { limit: 5, threshold: 0.45 });
  } catch (err) {
    req.log.warn({ err }, "RAG retrieval failed — proceeding without context");
  }

  // Load persona from settings (fall back to default if none)
  const settingsRows = await db.select().from(agentSettings).where(eq(agentSettings.id, 1));
  const persona = settingsRows[0]?.persona ??
    "You are Nexus, a highly capable personal AI agent. You are precise, thoughtful, and proactive.";

  // Build system prompt with RAG context
  let systemPrompt = persona;

  if (ragContext.length > 0) {
    const memCtx = ragContext.filter((r) => r.source === "memory");
    const docCtx = ragContext.filter((r) => r.source === "document");
    const webCtx = ragContext.filter((r) => r.source === "web_source");

    const sections: string[] = [];

    if (memCtx.length > 0) {
      sections.push(
        `RELEVANT MEMORIES (similarity-ranked):\n${memCtx
          .map((m) => `- [${m.metadata.type}] ${m.content} (importance: ${m.metadata.importanceScore})`)
          .join("\n")}`
      );
    }
    if (docCtx.length > 0) {
      sections.push(
        `RELEVANT KNOWLEDGE BASE DOCUMENTS:\n${docCtx
          .map((d) => `- ${d.title}: ${d.content.slice(0, 400)}`)
          .join("\n")}`
      );
    }
    if (webCtx.length > 0) {
      sections.push(
        `RELEVANT VERIFIED WEB SOURCES:\n${webCtx
          .map((w) => `- ${w.title} (trust ${((w.metadata.trustScore as number) * 100).toFixed(0)}%): ${w.content.slice(0, 300)}`)
          .join("\n")}`
      );
    }

    if (sections.length > 0) {
      systemPrompt += `\n\nUse the following context from your knowledge base when relevant to the user's question. Do not mention that you are reading from a context block — use it naturally:\n\n${sections.join("\n\n")}`;
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send RAG metadata first so the client can show the context indicator
  if (ragContext.length > 0) {
    const ragMeta = {
      ragContext: {
        memoriesUsed: ragContext.filter((r) => r.source === "memory").length,
        documentsUsed: ragContext.filter((r) => r.source === "document").length,
        webSourcesUsed: ragContext.filter((r) => r.source === "web_source").length,
        total: ragContext.length,
      },
    };
    res.write(`data: ${JSON.stringify(ragMeta)}\n\n`);
  }

  let fullResponse = "";

  try {
    // Prepend system prompt as the first user/model exchange
    const geminiContents = [
      {
        role: "user" as const,
        parts: [{ text: systemPrompt }],
      },
      {
        role: "model" as const,
        parts: [{ text: "Understood. I will use the provided context to assist you accurately." }],
      },
      ...chatHistory.map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      })),
    ];

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: geminiContents,
      config: { maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId,
      role: "assistant",
      content: fullResponse,
    });

    // Auto-rename on first exchange (title is still the default "New Conversation")
    const allMsgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    if (allMsgs.length === 2 && convo.title === "New Conversation") {
      try {
        const titleResult = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user" as const,
              parts: [{
                text: `Generate a concise 4-6 word title for a conversation that starts with this user message: "${body.data.content}"\n\nRespond with ONLY the title, no quotes, no punctuation at the end.`,
              }],
            },
          ],
          config: { maxOutputTokens: 30 },
        });
        const newTitle = titleResult.text?.trim().replace(/^["']|["']$/g, "").slice(0, 60);
        if (newTitle && newTitle.length > 2) {
          await db
            .update(conversations)
            .set({ title: newTitle })
            .where(eq(conversations.id, conversationId));
          res.write(`data: ${JSON.stringify({ titleUpdate: { id: conversationId, title: newTitle } })}\n\n`);
        }
      } catch (err) {
        req.log.warn({ err }, "Title generation failed — keeping default");
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    req.log.error({ err }, "Gemini stream error");
    res.write(`data: ${JSON.stringify({ error: "AI generation failed" })}\n\n`);
  }

  res.end();
});

router.post("/gemini/generate-image", async (req, res) => {
  const parsed = GenerateGeminiImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { b64_json, mimeType } = await generateImage(parsed.data.prompt);
  res.json({ b64_json, mimeType });
});

export default router;
