import { pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { vectorType } from "./vectorType";

export const webSources = pgTable("web_sources", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  snippet: text("snippet").notNull(),
  normalizedSummary: text("normalized_summary"),
  trustScore: real("trust_score").notNull().default(0.5),
  verificationStatus: text("verification_status")
    .notNull()
    .$type<"pending" | "verified" | "uncertain" | "conflicted">()
    .default("pending"),
  embedding: vectorType("embedding"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertWebSourceSchema = createInsertSchema(webSources).omit({
  id: true,
  lastCheckedAt: true,
  embedding: true,
});

export type WebSource = typeof webSources.$inferSelect;
export type InsertWebSource = z.infer<typeof insertWebSourceSchema>;
