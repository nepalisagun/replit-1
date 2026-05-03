import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentSettings = pgTable("agent_settings", {
  id: integer("id").primaryKey().default(1),
  agentName: text("agent_name").notNull().default("Nexus"),
  persona: text("persona").notNull().default(
    "You are Nexus, a highly capable personal AI agent. You are precise, thoughtful, and proactive. You help users accomplish complex tasks by leveraging memory, documents, and web search to provide well-informed, contextual responses."
  ),
  defaultModel: text("default_model").notNull().default("gemini-2.5-flash"),
  memoryEnabled: boolean("memory_enabled").notNull().default(true),
  webSearchEnabled: boolean("web_search_enabled").notNull().default(true),
  reflectionEnabled: boolean("reflection_enabled").notNull().default(true),
  maxContextMessages: integer("max_context_messages").notNull().default(20),
  timezone: text("timezone").notNull().default("UTC"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const updateSettingsSchema = createInsertSchema(agentSettings).omit({
  id: true,
  updatedAt: true,
}).partial();

export type AgentSettings = typeof agentSettings.$inferSelect;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
