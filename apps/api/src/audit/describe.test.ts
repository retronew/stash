import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe as suite, expect, it } from "vitest";
import { describe } from "./describe";

// Every audited route needs a name, or the audit log shows it as "other".
// Reads the route files, so a new route fails here until describe.ts knows it.

const SRC = join(__dirname, "..");
/** Not audited (see middleware.ts isAudited). */
const SKIP = new Set(["webhooks"]);

/** "/api/media" for mediaRoutes, from index.ts. */
function mounts(): Map<string, string> {
  const index = readFileSync(join(SRC, "index.ts"), "utf8");
  return new Map([...index.matchAll(/app\.route\("([^"]+)", (\w+)\)/g)].map(([, prefix, name]) => [name, prefix]));
}

function writeRoutes(): string[] {
  const prefixes = mounts();
  const routes: string[] = [];
  for (const file of readdirSync(join(SRC, "routes"))) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts") || SKIP.has(file.replace(/\.ts$/, ""))) continue;
    const text = readFileSync(join(SRC, "routes", file), "utf8");
    for (const [, name, method, path] of text.matchAll(/(\w+Routes)\.(post|put|patch|delete)\("([^"]+)"/g)) {
      const prefix = prefixes.get(name);
      if (!prefix) continue;
      // Sample values for the parameters: ids are numbers, the rest words.
      const sample = path.replace(/:(\w+)\{[^}]+\}/g, "1").replace(/:(\w+)/g, (_, p) => (p === "id" ? "1" : "x"));
      routes.push(`${method.toUpperCase()} ${prefix}${sample === "/" ? "" : sample}`);
    }
  }
  return routes;
}

suite("audit names", () => {
  const routes = writeRoutes();

  it("finds the routes", () => {
    expect(routes.length).toBeGreaterThan(20);
  });

  it.each(routes)("%s has a name", (route) => {
    const [method, path] = route.split(" ");
    expect(describe(method, path, {}, undefined, {})).not.toBeNull();
  });
});
