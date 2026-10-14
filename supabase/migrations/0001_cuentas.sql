-- PaludIA · cuentas de usuario
-- Cada usuario solo puede leer y modificar sus propios datos (Row Level Security).
-- El plan y los créditos solo los cambia el servidor (clave de servicio), nunca el navegador.

-- Perfil público mínimo de cada cuenta
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url text check (char_length(avatar_url) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Preferencias personales
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  instructions text not null default '' check (char_length(instructions) <= 4000),
  default_mode text not null default 'normal' check (default_mode in ('rapido', 'normal', 'profundo')),
  web_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Plan de suscripción: lectura para el dueño, escritura solo desde el servidor
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'gratis' check (plan in ('gratis', 'pro', 'premium')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- Historial de conversaciones
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Conversación' check (char_length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_updated on public.conversations (user_id, updated_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_created on public.messages (conversation_id, created_at);

-- Activar la protección por fila en todas las tablas
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Perfiles: ver y editar solo el propio
drop policy if exists "perfil propio: ver" on public.profiles;
create policy "perfil propio: ver" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "perfil propio: editar" on public.profiles;
create policy "perfil propio: editar" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Configuración: ver y editar solo la propia
drop policy if exists "configuracion propia: ver" on public.user_settings;
create policy "configuracion propia: ver" on public.user_settings for select to authenticated using (user_id = auth.uid());
drop policy if exists "configuracion propia: editar" on public.user_settings;
create policy "configuracion propia: editar" on public.user_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Suscripción: solo lectura del plan propio (sin políticas de escritura = nadie puede escribir desde el navegador)
drop policy if exists "plan propio: ver" on public.subscriptions;
create policy "plan propio: ver" on public.subscriptions for select to authenticated using (user_id = auth.uid());

-- Conversaciones: todo sobre las propias
drop policy if exists "conversaciones propias" on public.conversations;
create policy "conversaciones propias" on public.conversations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Mensajes: solo dentro de conversaciones propias
drop policy if exists "mensajes propios" on public.messages;
create policy "mensajes propios" on public.messages for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );

-- Permisos de tabla: el navegador nunca puede insertar ni borrar perfil/plan
revoke all on public.profiles, public.user_settings, public.subscriptions, public.conversations, public.messages from anon;
revoke insert, delete on public.profiles, public.user_settings from authenticated;
revoke insert, update, delete on public.subscriptions from authenticated;
grant select, update on public.profiles, public.user_settings to authenticated;
grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.conversations, public.messages to authenticated;

-- Al registrarse: crear perfil, configuración y plan gratuito
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), 80),
    left(new.raw_user_meta_data ->> 'avatar_url', 500)
  )
  on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.subscriptions (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantener updated_at al día
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists touch_settings on public.user_settings;
create trigger touch_settings before update on public.user_settings for each row execute function public.touch_updated_at();
drop trigger if exists touch_conversations on public.conversations;
create trigger touch_conversations before update on public.conversations for each row execute function public.touch_updated_at();
