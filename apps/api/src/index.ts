import { Hono } from "hono";
import type { Env } from "#types";
import { DEV_USER, enabledProviders, getAuth, isDevBypass } from "#auth";
import { requireAuth } from "#auth-middleware";
import { auditMiddleware } from "#audit/index";
import { auditRoutes } from "#routes/audit";
import { statsRoutes } from "#routes/stats";
import { backupRoutes } from "#routes/backups";
import { scheduled } from "#scheduled";
import { queue } from "#media/consumer";
import type { MediaJob } from "#media/jobs";
import { webhookRoutes } from "#routes/webhooks";
import { messageRoutes } from "#routes/messages";
import { mediaRoutes } from "#routes/media";
import { accountRoutes } from "#routes/accounts";
import { settingsRoutes } from "#routes/settings";
import { eventRoutes } from "#routes/events";
import { mcpRoutes } from "#routes/mcp";
import { exportRoutes } from "#routes/export";
import { analysisRoutes } from "#routes/analysis";

const app = new Hono<{ Bindings: Env }>();

// First, so it also sees sign-out and requests the auth middleware rejects.
app.use(
  "/api/*",
  auditMiddleware(async (c) => {
    const session = await getAuth(c.env)
      .api.getSession({ headers: c.req.raw.headers })
      .catch(() => null);
    return session?.user.email ?? null;
  }),
);

// Better Auth owns /api/auth/* (OAuth redirects, callbacks, session, sign-out).
app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth(c.env).handler(c.req.raw));

app.use("/api/*", requireAuth);

// Behind the auth middleware: 200 with the signed-in user, 401 otherwise.
app.get("/api/me", async (c) => {
  if (isDevBypass(c.env)) return c.json({ user: DEV_USER });
  const session = await getAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  const user = session?.user;
  return c.json({ user: user ? { name: user.name, email: user.email, image: user.image } : null });
});

app.get("/api/health", (c) => c.json({ ok: true }));
// Lets the login page show only the providers that are configured.
app.get("/api/public/auth-providers", (c) => c.json({ providers: enabledProviders(c.env) }));
app.route("/api/webhooks", webhookRoutes);
app.route("/api/messages", messageRoutes);
app.route("/api/media", mediaRoutes);
app.route("/api/accounts", accountRoutes);
app.route("/api/events", eventRoutes);
app.route("/api/mcp", mcpRoutes);
app.route("/api/export", exportRoutes);
app.route("/api/analysis", analysisRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/audit", auditRoutes);
app.route("/api/stats", statsRoutes);
app.route("/api/backups", backupRoutes);

export default {
  fetch: app.fetch,
  queue,
  scheduled,
} satisfies ExportedHandler<Env, MediaJob>;
