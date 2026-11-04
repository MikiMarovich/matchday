-- =============================================================================
-- MATCHDAY — 001_schema.sql
-- Esquema base: enums, 7 tablas, constraints, índices y trigger de perfiles.
-- RLS activado en todas las tablas, SIN políticas (van en 003_rls.sql).
-- Ejecutar completo en Supabase → SQL Editor. Corre en una sola transacción:
-- si algo falla, no queda nada a medias.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------

create type public.player_position as enum (
  'ARQUERO',
  'DEFENSOR',
  'MEDIOCAMPISTA',
  'DELANTERO'
);

create type public.match_status as enum (
  'DRAFT',      -- borrador, solo lo ve el admin
  'OPEN',       -- inscripción abierta
  'CLOSED',     -- inscripción cerrada
  'PLAYED',     -- ya se jugó
  'CANCELLED'   -- suspendido
);

create type public.registration_status as enum (
  'PENDING_PAYMENT',  -- cupo reservado, falta transferir y subir comprobante
  'PENDING_REVIEW',   -- comprobante subido, el admin tiene que revisarlo
  'CONFIRMED',        -- pago aprobado
  'WAITLIST',         -- suplente, sin cupo
  'REJECTED',         -- pago rechazado (libera cupo)
  'CANCELLED'         -- cancelada por jugador/admin o plazo vencido (libera cupo)
);

create type public.payment_provider as enum (
  'MERCADO_PAGO',
  'NARANJA_X'
);

-- -----------------------------------------------------------------------------
-- 2. Función genérica para updated_at
-- -----------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Tablas
-- -----------------------------------------------------------------------------

-- 3.1 admins: emails con permisos de administrador. Invisible para la API.
create table public.admins (
  email      text primary key,
  created_at timestamptz not null default now(),
  constraint admins_email_lowercase check (email = lower(email))
);

-- 3.2 profiles: un perfil por usuario de auth.users (lo crea el trigger).
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  avatar_url text,
  position   public.player_position,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (full_name is null or char_length(full_name) between 1 and 100)
);

-- 3.3 matches: partidos.
create table public.matches (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  location    text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  price       integer not null,             -- pesos enteros
  max_players integer not null,
  status      public.match_status not null default 'DRAFT',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint matches_title_length   check (char_length(title) between 1 and 120),
  constraint matches_price_positive check (price >= 0),
  constraint matches_max_players    check (max_players between 2 and 50),
  constraint matches_ends_after     check (ends_at is null or ends_at > starts_at)
);

-- 3.4 payment_settings: medios de cobro (alias/CVU para transferencia).
create table public.payment_settings (
  id             uuid primary key default gen_random_uuid(),
  provider       public.payment_provider not null,
  alias          text not null,
  account_number text not null,             -- CVU / CBU
  holder_name    text not null,
  is_active      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint payment_settings_account_digits check (account_number ~ '^[0-9]{22}$')
);

-- Como máximo un medio activo a la vez.
create unique index payment_settings_one_active
  on public.payment_settings (is_active)
  where is_active;

-- 3.5 registrations: inscripciones de jugadores a partidos.
create table public.registrations (
  id                       uuid primary key default gen_random_uuid(),
  match_id                 uuid not null references public.matches (id) on delete cascade,
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  status                   public.registration_status not null,

  -- Snapshots al momento de reservar el cupo (no cambian si después se edita el partido o el medio de pago)
  price_snapshot           integer not null,
  payment_provider_snapshot public.payment_provider,
  payment_alias_snapshot   text,
  payment_account_snapshot text,
  payment_holder_snapshot  text,

  payment_deadline         timestamptz,     -- hasta cuándo se reserva el cupo en PENDING_PAYMENT
  receipt_path             text,            -- ruta en Storage: {user_id}/{registration_id}/{archivo}
  receipt_submitted_at     timestamptz,
  waitlisted_at            timestamptz,     -- orden de suplentes
  confirmed_at             timestamptz,
  reviewed_at              timestamptz,
  reviewed_by              uuid references public.profiles (id) on delete set null,
  rejection_reason         text,
  cancelled_at             timestamptz,
  cancellation_reason      text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint registrations_price_positive check (price_snapshot >= 0),

  -- Consistencia por estado
  constraint registrations_pending_payment_ok check (
    status <> 'PENDING_PAYMENT' or (
      payment_deadline is not null
      and payment_provider_snapshot is not null
      and payment_alias_snapshot   is not null
      and payment_account_snapshot is not null
      and payment_holder_snapshot  is not null
    )
  ),
  constraint registrations_pending_review_ok check (
    status <> 'PENDING_REVIEW' or (
      receipt_path is not null
      and receipt_submitted_at is not null
      and payment_provider_snapshot is not null
    )
  ),
  constraint registrations_confirmed_ok check (
    status <> 'CONFIRMED' or (
      confirmed_at is not null
      and payment_provider_snapshot is not null
    )
  ),
  constraint registrations_waitlist_ok check (
    status <> 'WAITLIST' or waitlisted_at is not null
  ),
  constraint registrations_rejected_ok check (
    status <> 'REJECTED' or (rejection_reason is not null and reviewed_at is not null)
  ),
  constraint registrations_cancelled_ok check (
    status <> 'CANCELLED' or (cancellation_reason is not null and cancelled_at is not null)
  )
);

-- Una sola inscripción activa por usuario y partido. Tras REJECTED o CANCELLED se puede volver a anotar.
create unique index registrations_one_active_per_user
  on public.registrations (match_id, user_id)
  where status not in ('REJECTED', 'CANCELLED');

create index registrations_match_status_idx on public.registrations (match_id, status);
create index registrations_user_idx         on public.registrations (user_id);
create index registrations_reviewed_by_idx  on public.registrations (reviewed_by);
create index registrations_waitlist_idx
  on public.registrations (match_id, waitlisted_at)
  where status = 'WAITLIST';

-- 3.6 notifications_log: registro de emails enviados (Resend).
create table public.notifications_log (
  id                  bigint generated always as identity primary key,
  registration_id     uuid references public.registrations (id) on delete set null,
  recipient_email     text not null,
  type                text not null,        -- ej: RECEIPT_SUBMITTED, PAYMENT_APPROVED, PAYMENT_REJECTED, PROMOTED
  status              text not null,
  provider_message_id text,
  error               text,
  created_at          timestamptz not null default now(),
  constraint notifications_log_status check (status in ('SENT', 'FAILED'))
);

create index notifications_log_registration_idx on public.notifications_log (registration_id);

-- 3.7 audit_logs: acciones del admin.
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_email text,
  action      text not null,                -- ej: APPROVE_PAYMENT, CREATE_MATCH
  entity_type text not null,                -- ej: registration, match, payment_settings
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_actor_idx  on public.audit_logs (actor_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- 4. Triggers updated_at
-- -----------------------------------------------------------------------------

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

create trigger payment_settings_set_updated_at
  before update on public.payment_settings
  for each row execute function public.set_updated_at();

create trigger registrations_set_updated_at
  before update on public.registrations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Perfil automático al registrarse con Google
-- -----------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 6. Row Level Security: activado en todo, sin políticas todavía (003_rls.sql)
-- -----------------------------------------------------------------------------

alter table public.admins            enable row level security;
alter table public.profiles          enable row level security;
alter table public.matches           enable row level security;
alter table public.payment_settings  enable row level security;
alter table public.registrations     enable row level security;
alter table public.notifications_log enable row level security;
alter table public.audit_logs        enable row level security;

-- admins no se expone nunca por la API (ni siquiera con políticas futuras por error).
revoke all on table public.admins from anon, authenticated;

commit;

-- =============================================================================
-- DESPUÉS DE EJECUTAR: cargá tu email de admin (en minúsculas) en una consulta aparte:
--
--   insert into public.admins (email) values ('tu-email@gmail.com');
--
-- Verificación rápida (tienen que salir 7 filas con rls = true):
--
--   select relname, relrowsecurity as rls
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'r'
--   order by 1;
-- =============================================================================
