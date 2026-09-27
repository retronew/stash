import { Hono } from "hono";
import type { Env } from "#types";
import { handleMcpPost } from "#mcp/server";
import { publicOrigin } from "#origin";

/**
 * MCP endpoint (Streamable HTTP, stateless) at /api/mcp. Auth is the normal
 * API middleware, so clients send `Authorization: Bearer <API token>`.
 */
export const mcpRoutes = new Hono<{ Bindings: Env }>();

mcpRoutes.post("/", async (c) =>
  handleMcpPost(await c.req.text(), {
    env: c.env,
    origin: publicOrigin(c.env, c.req.url),
  }),
);

// No server-initiated stream and no sessions to end.
mcpRoutes.on(["GET", "DELETE"], "/", (c) =>
  c.json({ error: "method not allowed" }, 405, { Allow: "POST" }),
);
