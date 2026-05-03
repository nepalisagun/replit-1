import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, memories, documents, agentEvents, toolHealth } from "@workspace/db";
import { desc, gte, sql } from "drizzle-orm";

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

export default router;
