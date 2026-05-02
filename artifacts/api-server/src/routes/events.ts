import { Router } from "express";
import { db } from "@workspace/db";
import { agentEvents } from "@workspace/db";
import { desc } from "drizzle-orm";
import { ListAgentEventsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/events", async (req, res) => {
  const parsed = ListAgentEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { status, limit } = parsed.data;
  const results = await db
    .select()
    .from(agentEvents)
    .orderBy(desc(agentEvents.createdAt))
    .limit(limit ?? 100);

  const filtered = status ? results.filter((e) => e.status === status) : results;

  res.json(filtered.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    contextId: e.contextId,
    payload: e.payload,
    status: e.status,
    createdAt: e.createdAt,
  })));
});

export default router;
