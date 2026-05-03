import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { vectorType } from "./vectorType";

export const memories = pgTable("memories", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull().$type<"agent" | "user">(),
  type: text("type").notNull().$type<"preference" | "fact" | "workflow" | "lesson">(),
  content: text("content").notNull(),
  importanceScore: integer("importance_score").notNull().default(3),
  category: text("category"),
  embedding: vectorType("embedding"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertMemorySchema = createInsertSchema(memories).omit({
  id: true,
  createdAt: true,
  embedding: true,
});

export type Memory = typeof memories.$inferSelect;
export type InsertMemory = z.infer<typeof insertMemorySchema>;
