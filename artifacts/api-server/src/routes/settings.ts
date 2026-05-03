import { Router } from "express";
import { db } from "@workspace/db";
import { agentSettings, updateSettingsSchema } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function getOrCreateSettings() {
  const rows = await db.select().from(agentSettings).where(eq(agentSettings.id, 1));
  if (rows.length > 0) return rows[0];
  const inserted = await db
    .insert(agentSettings)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  if (inserted.length > 0) return inserted[0];
  return (await db.select().from(agentSettings).where(eq(agentSettings.id, 1)))[0];
}

router.get("/settings", async (req, res) => {
  const settings = await getOrCreateSettings();
  res.json(settings);
});

router.patch("/settings", async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid settings", details: parsed.error.issues });
    return;
  }

  await getOrCreateSettings();

  const updated = await db
    .update(agentSettings)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(agentSettings.id, 1))
    .returning();

  res.json(updated[0]);
});

export default router;
