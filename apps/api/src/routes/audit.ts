import { Hono } from "hono";
import type { Env } from "#types";
import { cursorParam, limitParam } from "#params";

/** The audit trail, mounted at /api/audit. Retention is one of Settings → Data's targets. */
export const auditRoutes = new Hono<{ Bindings: Env }>();

interface AuditRow {
  id: number;
  created_at: number;
  actor: string;
  action: string;
  target: string;
  summary: string;
  status: number | null;
  ip: string;
  user_agent: string;
  detail: string;
}

function toJson(r: AuditRow) {
  let detail: unknown = {};
  try {
    detail = JSON.parse(r.detail);
  } catch {
    // keep {}
  }
  return {
    id: r.id,
    createdAt: r.created_at,
    actor: r.actor,
    action: r.action,
    target: r.target,
    summary: r.summary,
    status: r.status,
    ip: r.ip,
    userAgent: r.user_agent,
    detail,
  };
}

/**
 * GET /api/audit
 *   category  action prefix, e.g. "message" (matches message.*); "other" = no prefix
 *   action    exact action
 *   actor     exact actor
 *   result    "ok" | "error"
 *   q         substring of summary / target / ip
 *   before    id cursor for older pages
 *   limit     default 50, max 200
 */
auditRoutes.get("/", async (c) => {
  const q = c.req.query();
  const where: string[] = [];
  const args: unknown[] = [];
  if (q.category === "other") {
    where.push("action NOT LIKE '%.%'");
  } else if (q.category) {
    where.push("action LIKE ?");
    args.push(`${q.category}.%`);
  }
  if (q.action) {
    where.push("action = ?");
    args.push(q.action);
  }
  if (q.actor) {
    where.push("actor = ?");
    args.push(q.actor);
  }
  if (q.result === "ok") where.push("(status IS NULL OR status < 400)");
  if (q.result === "error") where.push("status >= 400");
  if (q.q) {
    where.push("(summary LIKE ? OR target LIKE ? OR ip LIKE ?)");
    const like = `%${q.q}%`;
    args.push(like, like, like);
  }
  const before = cursorParam(q.before);
  if (before) {
    where.push("id < ?");
    args.push(before);
  }
  const limit = limitParam(q.limit, 50, 200);
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM audit_log ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ?`,
  )
    .bind(...args, limit + 1)
    .all<AuditRow>();
  const page = results.slice(0, limit);
  return c.json({
    entries: page.map(toJson),
    nextCursor: results.length > limit ? page[page.length - 1].id : null,
  });
});

/** Distinct actions and actors for the filter menus. */
auditRoutes.get("/facets", async (c) => {
  const [actions, actors] = await c.env.DB.batch<{ value: string; count: number }>([
    c.env.DB.prepare("SELECT action AS value, COUNT(*) AS count FROM audit_log GROUP BY action ORDER BY action"),
    c.env.DB.prepare("SELECT actor AS value, COUNT(*) AS count FROM audit_log GROUP BY actor ORDER BY count DESC"),
  ]);
  return c.json({ actions: actions.results, actors: actors.results });
});
