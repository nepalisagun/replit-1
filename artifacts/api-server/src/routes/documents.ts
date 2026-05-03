import { Router } from "express";
import { db } from "@workspace/db";
import { documents } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  ListDocumentsQueryParams,
  CreateDocumentBody,
  GetDocumentParams,
  DeleteDocumentParams,
} from "@workspace/api-zod";
import { getEmbedding } from "../lib/embeddings";

const router = Router();

router.get("/documents", async (req, res) => {
  const parsed = ListDocumentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { source, limit } = parsed.data;
  const results = await db
    .select()
    .from(documents)
    .orderBy(desc(documents.createdAt))
    .limit(limit ?? 50);

  const filtered = source ? results.filter((d) => d.source === source) : results;

  res.json(filtered.map((d) => ({
    id: d.id,
    title: d.title,
    source: d.source,
    url: d.url,
    canonicalCategory: d.canonicalCategory,
    content: d.content,
    createdAt: d.createdAt,
  })));
});

router.post("/documents", async (req, res) => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  let embedding: number[] | null = null;
  try {
    const textToEmbed = `${parsed.data.title}\n${parsed.data.content}`.slice(0, 512);
    embedding = await getEmbedding(textToEmbed);
  } catch (err) {
    req.log.warn({ err }, "Embedding generation failed for document — storing without vector");
  }

  const [doc] = await db
    .insert(documents)
    .values({
      title: parsed.data.title,
      source: parsed.data.source,
      url: parsed.data.url ?? null,
      canonicalCategory: parsed.data.canonicalCategory ?? null,
      content: parsed.data.content,
      ...(embedding ? { embedding } : {}),
    })
    .returning();
  res.status(201).json({
    id: doc.id,
    title: doc.title,
    source: doc.source,
    url: doc.url,
    canonicalCategory: doc.canonicalCategory,
    content: doc.content,
    createdAt: doc.createdAt,
  });
});

router.get("/documents/:id", async (req, res) => {
  const params = GetDocumentParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, params.data.id));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json({
    id: doc.id,
    title: doc.title,
    source: doc.source,
    url: doc.url,
    canonicalCategory: doc.canonicalCategory,
    content: doc.content,
    createdAt: doc.createdAt,
  });
});

router.delete("/documents/:id", async (req, res) => {
  const params = DeleteDocumentParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db
    .delete(documents)
    .where(eq(documents.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.status(204).send();
});

export default router;
