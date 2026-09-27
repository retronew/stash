import { Hono, type Context } from "hono";
import type { Env } from "#types";
import {
  BackupError,
  deleteBackup,
  getBackupObject,
  listBackups,
  restoreBackup,
  writeBackup,
  type RestoreMode,
} from "#backups";

/** Backups of the messages in R2, as in PickIt; mounted at /api/backups. */
export const backupRoutes = new Hono<{ Bindings: Env }>();

function fail(c: Context<{ Bindings: Env }>, err: unknown) {
  if (err instanceof BackupError) return c.json({ error: err.message }, err.status);
  throw err;
}

backupRoutes.get("/", async (c) => c.json({ backups: await listBackups(c.env) }));

/** Back up now. */
backupRoutes.post("/", async (c) => c.json(await writeBackup(c.env, "manual"), 201));

backupRoutes.get("/:name", async (c) => {
  try {
    const name = c.req.param("name");
    const obj = await getBackupObject(c.env, name);
    return new Response(obj.body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (err) {
    return fail(c, err);
  }
});

/** body: { mode: "merge" | "replace", dryRun?: boolean } */
backupRoutes.post("/:name/restore", async (c) => {
  const body = await c.req.json<{ mode?: string; dryRun?: boolean }>().catch(() => ({}) as { mode?: string; dryRun?: boolean });
  if (body.mode !== "merge" && body.mode !== "replace") return c.json({ error: "mode must be merge or replace" }, 400);
  try {
    return c.json(await restoreBackup(c.env, c.req.param("name"), body.mode as RestoreMode, !!body.dryRun));
  } catch (err) {
    return fail(c, err);
  }
});

backupRoutes.delete("/:name", async (c) => {
  try {
    await deleteBackup(c.env, c.req.param("name"));
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err);
  }
});
