-- PaludIA · límites de uso por plan
-- Cada usuario tiene un contador de mensajes y otro de imágenes. El contador arranca con el
-- primer uso y se reinicia 24 horas después. Solo el servidor (clave de servicio) puede
-- consumir o devolver usos: el navegador solo puede leer los suyos.

create table if not exists public.usage_windows (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('mensaje', 'imagen')),
  window_start timestamptz not null default now(),
  used integer not null default 0 check (used >= 0),
  primary key (user_id, kind)
);

alter table public.usage_windows enable row level security;
drop policy if exists "uso propio: ver" on public.usage_windows;
create policy "uso propio: ver" on public.usage_windows for select to authenticated using (user_id = auth.uid());
revoke all on public.usage_windows from anon;
revoke insert, update, delete on public.usage_windows from authenticated;
grant select on public.usage_windows to authenticated;

-- Gasto estimado de toda la app por día (tope de seguridad global)
create table if not exists public.app_spend (
  day date primary key,
  usd numeric(12, 6) not null default 0
);
alter table public.app_spend enable row level security;
revoke all on public.app_spend from anon, authenticated;

-- Consume un uso si queda cupo. Devuelve si se permitió, cuántos lleva y cuándo se renueva.
create or replace function public.consume_quota(p_user uuid, p_kind text, p_limit integer)
returns table (allowed boolean, used integer, resets_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.usage_windows%rowtype;
begin
  insert into public.usage_windows (user_id, kind, window_start, used)
  values (p_user, p_kind, now(), 0)
  on conflict (user_id, kind) do nothing;

  select * into r from public.usage_windows w where w.user_id = p_user and w.kind = p_kind for update;

  if now() >= r.window_start + interval '24 hours' then
    r.window_start := now();
    r.used := 0;
  end if;

  if r.used >= p_limit then
    update public.usage_windows w set window_start = r.window_start, used = r.used where w.user_id = p_user and w.kind = p_kind;
    return query select false, r.used, r.window_start + interval '24 hours';
    return;
  end if;

  r.used := r.used + 1;
  update public.usage_windows w set window_start = r.window_start, used = r.used where w.user_id = p_user and w.kind = p_kind;
  return query select true, r.used, r.window_start + interval '24 hours';
end;
$$;

-- Devuelve un uso cuando la IA falla (para no cobrarle al usuario un error nuestro).
create or replace function public.refund_quota(p_user uuid, p_kind text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.usage_windows w set used = greatest(w.used - 1, 0) where w.user_id = p_user and w.kind = p_kind;
$$;

-- Suma gasto estimado del día y devuelve el total.
create or replace function public.add_spend(p_usd numeric)
returns numeric
language sql
security definer
set search_path = public
as $$
  insert into public.app_spend (day, usd) values ((now() at time zone 'utc')::date, p_usd)
  on conflict (day) do update set usd = public.app_spend.usd + excluded.usd
  returning usd;
$$;

revoke all on function public.consume_quota(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.refund_quota(uuid, text) from public, anon, authenticated;
revoke all on function public.add_spend(numeric) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.consume_quota(uuid, text, integer) to service_role';
    execute 'grant execute on function public.refund_quota(uuid, text) to service_role';
    execute 'grant execute on function public.add_spend(numeric) to service_role';
    execute 'grant select, insert, update on public.usage_windows, public.app_spend to service_role';
    execute 'grant select on public.subscriptions to service_role';
  end if;
end $$;
