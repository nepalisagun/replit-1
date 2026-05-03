import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, memories, documents, agentEvents, toolHealth, messageReactions } from "@workspace/db";
import { desc, eq, gte, sql } from "drizzle-orm";

const router = Router();

router.get("/stats/dashboard", async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    convCount,
    msgCount,
    memCount,
    docCount,
    recentErrors,
    memoriesByTypeRows,
    eventsByStatusRows,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(conversations),
    db.select({ count: sql<number>`count(*)::int` }).from(messages),
    db.select({ count: sql<number>`count(*)::int` }).from(memories),
    db.select({ count: sql<number>`count(*)::int` }).from(documents),
    db.select({ count: sql<number>`count(*)::int` }).from(agentEvents).where(
      sql`${agentEvents.status} = 'error' AND ${agentEvents.createdAt} >= ${since}`
    ),
    db.select({ type: memories.type, count: sql<number>`count(*)::int` }).from(memories).groupBy(memories.type),
    db.select({ status: agentEvents.status, count: sql<number>`count(*)::int` }).from(agentEvents).groupBy(agentEvents.status),
  ]);

  const memoriesByType: Record<string, number> = {};
  for (const row of memoriesByTypeRows) {
    if (row.type) memoriesByType[row.type] = row.count;
  }

  const eventsByStatus: Record<string, number> = {};
  for (const row of eventsByStatusRows) {
    if (row.status) eventsByStatus[row.status] = row.count;
  }

  res.json({
    totalConversations: convCount[0]?.count ?? 0,
    totalMessages: msgCount[0]?.count ?? 0,
    totalMemories: memCount[0]?.count ?? 0,
    totalDocuments: docCount[0]?.count ?? 0,
    recentErrors: recentErrors[0]?.count ?? 0,
    memoriesByType,
    eventsByStatus,
  });
});

router.get("/stats/tool-health", async (req, res) => {
  const tools = await db
    .select()
    .from(toolHealth)
    .orderBy(toolHealth.toolName);

  if (tools.length === 0) {
    const defaultTools = [
      { toolName: "gemini-chat", successRate: 1.0, recentFailures: 0, status: "healthy" as const },
      { toolName: "web-search", successRate: 0.95, recentFailures: 1, status: "healthy" as const },
      { toolName: "code-runner", successRate: 0.88, recentFailures: 3, status: "degraded" as const },
      { toolName: "git-integration", successRate: 1.0, recentFailures: 0, status: "healthy" as const },
    ];
    await db.insert(toolHealth).values(defaultTools).onConflictDoNothing();
    const seeded = await db.select().from(toolHealth).orderBy(toolHealth.toolName);
    res.json(seeded.map((t) => ({
      toolName: t.toolName,
      successRate: t.successRate,
      recentFailures: t.recentFailures,
      status: t.status,
      lastCheckedAt: t.lastCheckedAt,
    })));
    return;
  }

  res.json(tools.map((t) => ({
    toolName: t.toolName,
    successRate: t.successRate,
    recentFailures: t.recentFailures,
    status: t.status,
    lastCheckedAt: t.lastCheckedAt,
  })));
});

router.get("/stats/recent-activity", async (req, res) => {
  const events = await db
    .select()
    .from(agentEvents)
    .orderBy(desc(agentEvents.createdAt))
    .limit(20);

  res.json(events.map((e) => ({
    id: e.id,
    type: e.eventType,
    description: e.payload ? e.payload.substring(0, 120) : e.eventType,
    status: e.status,
    createdAt: e.createdAt,
  })));
});

router.get("/stats/feedback", async (req, res) => {
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [helpfulRows, unhelpfulRows, dailyRows, convRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` })
      .from(messageReactions)
      .where(eq(messageReactions.reaction, "helpful")),
    db.select({ count: sql<number>`count(*)::int` })
      .from(messageReactions)
      .where(eq(messageReactions.reaction, "unhelpful")),
    db.execute(sql`
      SELECT
        date_trunc('day', mr.created_at)::date::text AS date,
        count(*) FILTER (WHERE mr.reaction = 'helpful')::int AS helpful,
        count(*) FILTER (WHERE mr.reaction = 'unhelpful')::int AS unhelpful
      FROM message_reactions mr
      WHERE mr.created_at >= ${since7}
      GROUP BY 1
      ORDER BY 1
    `),
    db.execute(sql`
      SELECT
        c.id AS "conversationId",
        c.title,
        count(*) FILTER (WHERE mr.reaction = 'helpful')::int AS helpful,
        count(*) FILTER (WHERE mr.reaction = 'unhelpful')::int AS unhelpful
      FROM message_reactions mr
      JOIN messages m ON m.id = mr.message_id
      JOIN conversations c ON c.id = m.conversation_id
      GROUP BY c.id, c.title
      ORDER BY (count(*)) DESC
      LIMIT 10
    `),
  ]);

  const days7: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    days7.push(d.toISOString().slice(0, 10));
  }

  const dailyMap = new Map<string, { helpful: number; unhelpful: number }>();
  for (const row of dailyRows.rows as Array<{ date: string; helpful: number; unhelpful: number }>) {
    dailyMap.set(row.date, { helpful: row.helpful, unhelpful: row.unhelpful });
  }

  const last7Days = days7.map((date) => ({
    date,
    helpful: dailyMap.get(date)?.helpful ?? 0,
    unhelpful: dailyMap.get(date)?.unhelpful ?? 0,
  }));

  res.json({
    totalHelpful: helpfulRows[0]?.count ?? 0,
    totalUnhelpful: unhelpfulRows[0]?.count ?? 0,
    last7Days,
    topConversations: (convRows.rows as Array<{ conversationId: number; title: string; helpful: number; unhelpful: number }>).map((r) => ({
      conversationId: r.conversationId,
      title: r.title,
      helpful: r.helpful,
      unhelpful: r.unhelpful,
    })),
  });
});

export default router;
