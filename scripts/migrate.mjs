// Aplica las migraciones de supabase/migrations al publicar, si existe DATABASE_URL.
// Cada archivo se aplica una sola vez y queda anotado en paludia_meta.migrations.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migraciones] Sin DATABASE_URL: no se tocan las tablas.");
  process.exit(0);
}

const dir = path.join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query("create schema if not exists paludia_meta");
  await client.query("create table if not exists paludia_meta.migrations (name text primary key, applied_at timestamptz not null default now())");
  await client.query("revoke all on schema paludia_meta from public");
  const done = new Set((await client.query("select name from paludia_meta.migrations")).rows.map((r) => r.name));
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(path.join(dir, file), "utf8");
    console.log(`[migraciones] Aplicando ${file}…`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into paludia_meta.migrations (name) values ($1)", [file]);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }
  console.log("[migraciones] Base de datos al día.");
} catch (err) {
  console.error("[migraciones] Error:", err.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
