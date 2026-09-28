// Copies the remote D1 database into the local one (wrangler dev), for debugging
// with real data: `pnpm db:pull`. Stop `pnpm dev` first.
//
// Read-only on the remote side. The local database is wiped, rebuilt from the
// migrations, then filled table by table: `wrangler d1 export` can't export a
// whole database that has an FTS5 table, and the search index is rebuilt by the
// migration's triggers as rows go in. Sign-in tables (users, sessions, OAuth
// tokens) are left out; local dev signs in with DEV_AUTH_BYPASS.
// Files stay in the remote R2 bucket, so pulled images don't load locally.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const DB = "stash-db";
const SKIP = new Set(["sqlite_sequence", "d1_migrations", "user", "session", "account", "verification"]);
/** Parents before children, for the foreign keys. */
const FIRST = ["bot_accounts", "messages"];
const tmp = join(".wrangler", "pull-db");
// Run wrangler's own script with node: no shell, so SQL with spaces stays one argument on Windows too.
const WRANGLER = join(dirname(createRequire(import.meta.url).resolve("wrangler/package.json")), "bin", "wrangler.js");

function wrangler(args, { quiet = false } = {}) {
  return execFileSync(process.execPath, [WRANGLER, ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "inherit"],
  });
}

function remoteTables() {
  const out = wrangler(
    ["d1", "execute", DB, "--remote", "--json", "--command", "SELECT name FROM sqlite_master WHERE type = 'table'"],
    { quiet: true },
  );
  const names = JSON.parse(out)[0].results.map((r) => r.name);
  const tables = names.filter((n) => !SKIP.has(n) && !n.startsWith("messages_fts") && !n.startsWith("_cf_"));
  return [...FIRST.filter((t) => tables.includes(t)), ...tables.filter((t) => !FIRST.includes(t))];
}

const tables = remoteTables();
console.log(`Tables: ${tables.join(", ")}`);

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
for (const table of tables) {
  console.log(`Exporting ${table}…`);
  wrangler(["d1", "export", DB, "--remote", "--no-schema", "--table", table, "--output", join(tmp, `${table}.sql`)], { quiet: true });
}

console.log("Resetting the local database…");
rmSync(join(".wrangler", "state", "v3", "d1"), { recursive: true, force: true });
wrangler(["d1", "migrations", "apply", "DB", "--local"], { quiet: true });

// One file, so the rows go in in order within a single import.
const all = join(tmp, "all.sql");
writeFileSync(all, tables.map((t) => readFileSync(join(tmp, `${t}.sql`), "utf8")).join("\n"));
console.log("Importing…");
wrangler(["d1", "execute", DB, "--local", "--yes", "--file", all], { quiet: true });

const counts = JSON.parse(
  wrangler(
    ["d1", "execute", DB, "--local", "--json", "--command", tables.map((t) => `SELECT '${t}' AS t, COUNT(*) AS n FROM "${t}"`).join("; ")],
    { quiet: true },
  ),
);
for (const { results } of counts) for (const { t, n } of results) console.log(`  ${t}: ${n}`);
rmSync(tmp, { recursive: true, force: true });
console.log("Done.");
