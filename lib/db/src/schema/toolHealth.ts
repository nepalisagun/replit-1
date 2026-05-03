import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const toolHealth = pgTable("tool_health", {
  id: serial("id").primaryKey(),
  toolName: text("tool_name").notNull().unique(),
  successRate: real("success_rate").notNull().default(1.0),
  recentFailures: integer("recent_failures").notNull().default(0),
  status: text("status").notNull().$type<"healthy" | "degraded" | "disabled">().default("healthy"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertToolHealthSchema = createInsertSchema(toolHealth).omit({
  id: true,
});

export type ToolHealth = typeof toolHealth.$inferSelect;
export type InsertToolHealth = z.infer<typeof insertToolHealthSchema>;
