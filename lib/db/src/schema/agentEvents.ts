import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentEvents = pgTable("agent_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  contextId: text("context_id"),
  payload: text("payload"),
  status: text("status").notNull().$type<"success" | "error" | "retrying" | "degraded">(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAgentEventSchema = createInsertSchema(agentEvents).omit({
  id: true,
  createdAt: true,
});

export type AgentEvent = typeof agentEvents.$inferSelect;
export type InsertAgentEvent = z.infer<typeof insertAgentEventSchema>;
