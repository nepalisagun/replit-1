import { Router } from "express";
import { db } from "@workspace/db";
import { webSources, documents, agentEvents } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

const TRUSTED_DOMAINS = [
  "wikipedia.org",
  "github.com",
  "docs.python.org",
  "developer.mozilla.org",
  "stackoverflow.com",
  "arxiv.org",
  "nodejs.org",
  "npmjs.com",
  "pypi.org",
  "rust-lang.org",
  "docs.microsoft.com",
  "learn.microsoft.com",
  "docs.aws.amazon.com",
  "cloud.google.com",
  "kubernetes.io",
  "docker.com",
];

function domainTrustScore(url: string): number {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    if (TRUSTED_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) {
      return 0.9;
    }
    if (domain.endsWith(".gov") || domain.endsWith(".edu")) return 0.85;
    if (domain.endsWith(".org")) return 0.7;
    return 0.5;
  } catch {
    return 0.3;
  }
}

async function fetchWithJina(url: string): Promise<string | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const resp = await fetch(jinaUrl, {
      headers: {
        Accept: "text/plain",
        "X-Timeout": "10",
        "X-Return-Format": "text",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    return text.slice(0, 8000);
  } catch {
    return null;
  }
}

router.post("/search", async (req, res) => {
  const { query, minSources = 2 } = req.body ?? {};

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  const trimmedQuery = query.trim();

  // Step 1: Ask Gemini to suggest 4 relevant URLs for this query
  let suggestedUrls: string[] = [];
  try {
    const urlResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a research assistant. For the query below, suggest exactly 4 highly relevant, real URLs that are likely to contain accurate information about this topic. Prefer official documentation, Wikipedia, well-known tech sites, and reputable sources.

Query: "${trimmedQuery}"

Return ONLY a JSON array of 4 URL strings, nothing else. Example: ["https://example.com/page1", "https://example2.com/page2", ...]`,
            },
          ],
        },
      ],
      config: {
        maxOutputTokens: 512,
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(urlResponse.text ?? "[]");
    if (Array.isArray(parsed)) {
      suggestedUrls = parsed.filter((u) => typeof u === "string" && u.startsWith("http")).slice(0, 4);
    }
  } catch (err) {
    req.log.error({ err }, "URL suggestion failed");
  }

  if (suggestedUrls.length === 0) {
    res.status(503).json({ error: "Could not generate search URLs" });
    return;
  }

  // Step 2: Fetch each URL via Jina AI Reader
  const fetchResults = await Promise.allSettled(
    suggestedUrls.map(async (url) => {
      const content = await fetchWithJina(url);
      return { url, content };
    })
  );

  const fetchedSources = fetchResults
    .filter((r): r is PromiseFulfilledResult<{ url: string; content: string | null }> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((s): s is { url: string; content: string } => s.content !== null && s.content.length > 100);

  if (fetchedSources.length < 1) {
    res.status(503).json({ error: "Could not fetch content from suggested URLs" });
    return;
  }

  // Step 3: Ask Gemini to verify and cross-reference content from all sources
  const sourceSections = fetchedSources
    .map((s, i) => `=== SOURCE ${i + 1}: ${s.url} ===\n${s.content.slice(0, 3000)}`)
    .join("\n\n");

  let verificationData: {
    verificationStatus: "verified" | "uncertain" | "conflicted";
    consolidatedSummary: string;
    sources: Array<{
      url: string;
      title: string;
      snippet: string;
      trustScore: number;
      agreesWithConsensus: boolean;
    }>;
  };

  try {
    const verifyResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a fact-verification agent. Given the user's query and content fetched from multiple web sources, cross-reference the information, identify consensus or conflicts, and produce a verified summary.

USER QUERY: "${trimmedQuery}"

${sourceSections}

Return a JSON object with this exact structure:
{
  "verificationStatus": "verified" | "uncertain" | "conflicted",
  "consolidatedSummary": "2-4 sentence verified summary. State explicitly if sources conflict or if information is uncertain.",
  "sources": [
    {
      "url": "exact URL from above",
      "title": "page title or domain name if not found",
      "snippet": "1-2 sentence extract most relevant to the query",
      "trustScore": 0.0-1.0,
      "agreesWithConsensus": true | false
    }
  ]
}

Rules:
- "verified": at least ${minSources} sources agree on the key facts
- "uncertain": only 1 source found or sources are ambiguous
- "conflicted": sources directly contradict each other
- trustScore: 0.9 for official docs/Wikipedia, 0.7 for reputable sites, 0.5 for unknown sites, lower for paywalled/error pages
- Include all sources you actually used (skip ones with no relevant content)
- consolidatedSummary must explicitly mention uncertainty when present

Return ONLY valid JSON.`,
            },
          ],
        },
      ],
      config: {
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    });

    verificationData = JSON.parse(verifyResponse.text ?? "{}");
    if (!verificationData.verificationStatus || !verificationData.consolidatedSummary) {
      throw new Error("Invalid verification response");
    }
  } catch (err) {
    req.log.error({ err }, "Verification step failed");

    await db.insert(agentEvents).values({
      eventType: "web-search",
      contextId: `search-${Date.now()}`,
      payload: `Search verification failed for query: "${trimmedQuery}"`,
      status: "error",
    });

    res.status(500).json({ error: "Verification failed" });
    return;
  }

  // Step 4: Apply domain-based trust floor and store sources
  const sourcesToStore = verificationData.sources.map((s) => {
    const domainScore = domainTrustScore(s.url);
    const finalTrust = Math.max(s.trustScore, domainScore * 0.9);
    return { ...s, trustScore: Math.min(1.0, finalTrust) };
  });

  const insertedSources = await db
    .insert(webSources)
    .values(
      sourcesToStore.map((s) => ({
        query: trimmedQuery,
        url: s.url,
        title: s.title,
        snippet: s.snippet,
        normalizedSummary: verificationData.consolidatedSummary,
        trustScore: s.trustScore,
        verificationStatus: verificationData.verificationStatus,
      }))
    )
    .returning();

  // Step 5: If verified, also store as a document for RAG
  let savedToDocuments = false;
  if (verificationData.verificationStatus === "verified") {
    await db.insert(documents).values({
      title: `Web Search: ${trimmedQuery}`,
      source: "web_verified",
      url: sourcesToStore[0]?.url ?? null,
      canonicalCategory: "general",
      content: `Query: ${trimmedQuery}\n\nVerified Summary:\n${verificationData.consolidatedSummary}\n\nSources:\n${sourcesToStore.map((s) => `- ${s.url} (trust: ${s.trustScore.toFixed(2)})`).join("\n")}`,
    });
    savedToDocuments = true;
  }

  // Step 6: Log the event
  await db.insert(agentEvents).values({
    eventType: "web-search",
    contextId: `search-${Date.now()}`,
    payload: `Query: "${trimmedQuery}" | Status: ${verificationData.verificationStatus} | Sources: ${sourcesToStore.length}`,
    status: verificationData.verificationStatus === "conflicted" ? "error" : "success",
  });

  res.json({
    query: trimmedQuery,
    verificationStatus: verificationData.verificationStatus,
    consolidatedSummary: verificationData.consolidatedSummary,
    sourcesChecked: sourcesToStore.length,
    sources: sourcesToStore.map((s) => ({
      url: s.url,
      title: s.title,
      snippet: s.snippet,
      trustScore: s.trustScore,
      verificationStatus: verificationData.verificationStatus,
    })),
    savedToDocuments,
  });
});

router.get("/web-sources", async (req, res) => {
  const status = req.query.status as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;

  const results = await db
    .select()
    .from(webSources)
    .orderBy(desc(webSources.lastCheckedAt))
    .limit(limit);

  const filtered = status ? results.filter((s) => s.verificationStatus === status) : results;

  res.json(
    filtered.map((s) => ({
      id: s.id,
      query: s.query,
      url: s.url,
      title: s.title,
      snippet: s.snippet,
      normalizedSummary: s.normalizedSummary,
      trustScore: s.trustScore,
      verificationStatus: s.verificationStatus,
      lastCheckedAt: s.lastCheckedAt,
    }))
  );
});

router.delete("/web-sources/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db.delete(webSources).where(eq(webSources.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).send();
});

export default router;
