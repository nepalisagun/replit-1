import { Router } from "express";
import { db } from "@workspace/db";
import { memories } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  ListMemoriesQueryParams,
  CreateMemoryBody,
  UpdateMemoryParams,
  UpdateMemoryBody,
  DeleteMemoryParams,
} from "@workspace/api-zod";
import { getEmbedding } from "../lib/embeddings";

const router = Router();

router.get("/memories", async (req, res) => {
  const parsed = ListMemoriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { type, owner, limit } = parsed.data;
  let query = db.select().from(memories).orderBy(desc(memories.importanceScore), desc(memories.createdAt)).$dynamic();

  const results = await query.limit(limit ?? 50);

  const filtered = results.filter((m) => {
    if (type && m.type !== type) return false;
    if (owner && m.owner !== owner) return false;
    return true;
  });

  res.json(filtered.map((m) => ({
    id: m.id,
    owner: m.owner,
    type: m.type,
    content: m.content,
    importanceScore: m.importanceScore,
    category: m.category,
    createdAt: m.createdAt,
  })));
});

router.post("/memories", async (req, res) => {
  const parsed = CreateMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  let embedding: number[] | null = null;
  try {
    embedding = await getEmbedding(parsed.data.content);
  } catch (err) {
    req.log.warn({ err }, "Embedding generation failed for memory — storing without vector");
  }

  const [memory] = await db
    .insert(memories)
    .values({
      owner: parsed.data.owner,
      type: parsed.data.type,
      content: parsed.data.content,
      importanceScore: parsed.data.importanceScore,
      category: parsed.data.category ?? null,
      ...(embedding ? { embedding } : {}),
    })
    .returning();
  res.status(201).json({
    id: memory.id,
    owner: memory.owner,
    type: memory.type,
    content: memory.content,
    importanceScore: memory.importanceScore,
    category: memory.category,
    createdAt: memory.createdAt,
  });
});

router.put("/memories/:id", async (req, res) => {
  const params = UpdateMemoryParams.safeParse({ id: req.params.id });
  const body = UpdateMemoryBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const updates: Partial<typeof memories.$inferInsert> = {};
  if (body.data.content !== undefined) {
    updates.content = body.data.content;
    try {
      updates.embedding = await getEmbedding(body.data.content);
    } catch {
      // store without updating embedding
    }
  }
  if (body.data.importanceScore !== undefined) updates.importanceScore = body.data.importanceScore;
  if (body.data.category !== undefined) updates.category = body.data.category;

  const [updated] = await db
    .update(memories)
    .set(updates)
    .where(eq(memories.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }
  res.json({
    id: updated.id,
    owner: updated.owner,
    type: updated.type,
    content: updated.content,
    importanceScore: updated.importanceScore,
    category: updated.category,
    createdAt: updated.createdAt,
  });
});

router.delete("/memories/:id", async (req, res) => {
  const params = DeleteMemoryParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db
    .delete(memories)
    .where(eq(memories.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }
  res.status(204).send();
});

export default router;
