import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getEmbedding, vectorToSql } from "../lib/embeddings";

const router = Router();

export interface RagResult {
  id: number;
  source: "memory" | "document" | "web_source";
  content: string;
  title?: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export async function retrieveContext(
  query: string,
  opts: { limit?: number; threshold?: number } = {}
): Promise<RagResult[]> {
  const { limit = 5, threshold = 0.45 } = opts;

  const embedding = await getEmbedding(query);
  const vectorStr = vectorToSql(embedding);

  const [memRows, docRows, srcRows] = await Promise.all([
    db.execute(sql`
      SELECT id, content, type, category, importance_score,
             1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM memories
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `),
    db.execute(sql`
      SELECT id, title, content, source, url,
             1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM documents
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `),
    db.execute(sql`
      SELECT id, query, title, snippet, normalized_summary, trust_score, verification_status,
             1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM web_sources
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `),
  ]);

  const results: RagResult[] = [];

  for (const row of memRows.rows) {
    const sim = Number(row.similarity);
    if (sim >= threshold) {
      results.push({
        id: Number(row.id),
        source: "memory",
        content: String(row.content),
        similarity: sim,
        metadata: { type: row.type, category: row.category, importanceScore: row.importance_score },
      });
    }
  }

  for (const row of docRows.rows) {
    const sim = Number(row.similarity);
    if (sim >= threshold) {
      results.push({
        id: Number(row.id),
        source: "document",
        content: String(row.content).slice(0, 800),
        title: String(row.title),
        similarity: sim,
        metadata: { source: row.source, url: row.url },
      });
    }
  }

  for (const row of srcRows.rows) {
    const sim = Number(row.similarity);
    if (sim >= threshold) {
      results.push({
        id: Number(row.id),
        source: "web_source",
        content: String(row.normalized_summary ?? row.snippet),
        title: String(row.title),
        similarity: sim,
        metadata: {
          query: row.query,
          trustScore: row.trust_score,
          verificationStatus: row.verification_status,
        },
      });
    }
  }

  // Sort by similarity descending, return top-N overall
  return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

router.post("/rag/search", async (req, res) => {
  const { query, limit, threshold } = req.body ?? {};

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  try {
    const results = await retrieveContext(query.trim(), {
      limit: typeof limit === "number" ? limit : 10,
      threshold: typeof threshold === "number" ? threshold : 0.45,
    });
    res.json({ query: query.trim(), results });
  } catch (err) {
    req.log.error({ err }, "RAG search failed");
    res.status(500).json({ error: "RAG search failed" });
  }
});

export default router;
