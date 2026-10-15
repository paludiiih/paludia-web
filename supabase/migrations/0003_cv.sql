-- PaludIA · cupos de nuevas herramientas (CV y futuras), con ventana configurable.
-- Aditivo: no cambia el comportamiento de los cupos de chat (24 h). Permite
-- tipos de cupo nuevos (ej. 'cv') y una ventana en horas distinta (ej. 720 = 30 días).

-- 1) Permitir más tipos de cupo además de 'mensaje' e 'imagen'.
alter table public.usage_windows drop constraint if exists usage_windows_kind_check;

-- 2) consume_quota con ventana configurable en horas (default 24 = igual que antes).
create or replace function public.consume_quota(p_user uuid, p_kind text, p_limit integer, p_hours integer)
returns table (allowed boolean, used integer, resets_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.usage_windows%rowtype;
  v interval := make_interval(hours => p_hours);
begin
  insert into public.usage_windows (user_id, kind, window_start, used)
  values (p_user, p_kind, now(), 0)
  on conflict (user_id, kind) do nothing;

  select * into r from public.usage_windows w where w.user_id = p_user and w.kind = p_kind for update;

  if now() >= r.window_start + v then
    r.window_start := now();
    r.used := 0;
  end if;

  if r.used >= p_limit then
    update public.usage_windows w set window_start = r.window_start, used = r.used where w.user_id = p_user and w.kind = p_kind;
    return query select false, r.used, r.window_start + v;
    return;
  end if;

  r.used := r.used + 1;
  update public.usage_windows w set window_start = r.window_start, used = r.used where w.user_id = p_user and w.kind = p_kind;
  return query select true, r.used, r.window_start + v;
end;
$$;

revoke all on function public.consume_quota(uuid, text, integer, integer) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.consume_quota(uuid, text, integer, integer) to service_role';
  end if;
end $$;
