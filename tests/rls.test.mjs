// Prueba de permisos de la base de datos con un Postgres embebido (PGlite).
// Simula el esquema "auth" de Supabase y verifica que cada usuario solo vea lo suyo.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(here, "../supabase/migrations/0001_cuentas.sql"), "utf8");
const db = new PGlite();
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? "OK   " : "FALLA") + "  " + msg); if (!cond) failures++; };
async function expectError(fn, msg) { try { await fn(); ok(false, msg + " (no dio error)"); } catch { ok(true, msg); } }

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`);
await db.exec(sql);
await db.exec(sql); // se puede aplicar dos veces sin romper nada
ok(true, "la migración se aplica (y se puede volver a aplicar)");

const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
  ('${A}', 'ana@ejemplo.com', '{"full_name":"Ana Pérez"}'),
  ('${B}', 'beto@ejemplo.com', '{}')`);
const prof = await db.query(`select id, display_name from public.profiles order by display_name`);
ok(prof.rows.length === 2, "el registro crea el perfil automáticamente");
ok(prof.rows.some((r) => r.display_name === "Ana Pérez") && prof.rows.some((r) => r.display_name === "beto"), "toma el nombre de Google o del correo");
const subs = await db.query(`select plan from public.subscriptions`);
ok(subs.rows.every((r) => r.plan === "gratis"), "cada cuenta nueva arranca en el plan Gratis");

async function as(uid, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}

// Datos de Beto
await as(B, () => db.exec(`insert into public.conversations (user_id, title) values ('${B}', 'Secreto de Beto')`));
const convB = (await db.query(`select id from public.conversations where user_id = '${B}'`)).rows[0].id;
await as(B, () => db.exec(`insert into public.messages (conversation_id, user_id, role, content) values ('${convB}', '${B}', 'user', 'hola')`));

await as(A, async () => {
  const p = await db.query(`select * from public.profiles`);
  ok(p.rows.length === 1 && p.rows[0].id === A, "Ana solo ve su propio perfil");
  const c = await db.query(`select * from public.conversations`);
  ok(c.rows.length === 0, "Ana no ve las conversaciones de Beto");
  const m = await db.query(`select * from public.messages`);
  ok(m.rows.length === 0, "Ana no ve los mensajes de Beto");
  await expectError(() => db.exec(`insert into public.messages (conversation_id, user_id, role, content) values ('${convB}', '${A}', 'user', 'intruso')`), "Ana no puede escribir en una conversación de Beto");
  await expectError(() => db.exec(`insert into public.conversations (user_id, title) values ('${B}', 'falsa')`), "Ana no puede crear conversaciones a nombre de Beto");
  const upd = await db.query(`update public.profiles set display_name = 'hackeado' where id = '${B}' returning id`);
  ok(upd.rows.length === 0, "Ana no puede cambiar el perfil de Beto");
  await expectError(() => db.exec(`update public.subscriptions set plan = 'premium' where user_id = '${A}'`), "Ana no puede subirse el plan desde el navegador");
  await expectError(() => db.exec(`insert into public.subscriptions (user_id, plan) values ('${A}', 'premium')`), "Ana no puede crearse un plan");
  const own = await db.query(`select plan from public.subscriptions`);
  ok(own.rows.length === 1 && own.rows[0].plan === "gratis", "Ana sí puede leer su propio plan");
  await db.exec(`update public.user_settings set instructions = 'Respondé corto', default_mode = 'profundo' where user_id = '${A}'`);
  const s = await db.query(`select instructions, default_mode from public.user_settings`);
  ok(s.rows.length === 1 && s.rows[0].default_mode === "profundo", "Ana puede guardar su configuración");
  await expectError(() => db.exec(`update public.user_settings set default_mode = 'turbo' where user_id = '${A}'`), "rechaza valores inválidos en la configuración");
  await db.exec(`insert into public.conversations (user_id, title) values ('${A}', 'Mi chat')`);
  const mine = await db.query(`select title from public.conversations`);
  ok(mine.rows.length === 1 && mine.rows[0].title === "Mi chat", "Ana puede crear y ver sus conversaciones");
});

await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
await expectError(() => db.query(`select * from public.conversations`), "un visitante sin sesión no puede leer nada");
await db.exec(`reset role;`);

await db.exec(`delete from auth.users where id = '${B}'`);
const left = await db.query(`select count(*)::int n from public.messages where user_id = '${B}'`);
ok(left.rows[0].n === 0, "al borrar la cuenta se borran todos sus datos");

console.log(failures ? `\n${failures} prueba(s) fallaron` : "\nTodas las pruebas pasaron");
process.exit(failures ? 1 : 0);
