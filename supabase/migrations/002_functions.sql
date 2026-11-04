-- =============================================================================
-- MATCHDAY — 002_functions.sql
-- Lógica de negocio en la base: inscripciones, pagos, suplentes y gestión admin.
--
-- Criterios:
--   * Todas las funciones expuestas son SECURITY DEFINER con search_path = ''
--     y validan permisos adentro (no confían en el frontend).
--   * Los helpers internos viven en el schema `private`, que la API no expone.
--   * Las escrituras de jugadores y admin pasan SOLO por estas funciones
--     (003_rls.sql no dará políticas de INSERT/UPDATE/DELETE).
--   * Cada acción admin escribe en audit_logs dentro de la misma transacción.
--   * Errores: se lanzan con un código estable en el mensaje (ej. MATCH_NOT_OPEN)
--     y un texto en español en el HINT. El frontend traduce por código.
--
-- Orden de locks (para evitar deadlocks): primero el partido, después la inscripción.
--
-- Ejecutar completo en Supabase → SQL Editor. Corre en una sola transacción.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Ajuste de esquema: plazo de pago configurable por partido
-- -----------------------------------------------------------------------------

alter table public.matches
  add column payment_window_minutes integer not null default 30,
  add constraint matches_payment_window check (payment_window_minutes between 5 and 1440);

comment on column public.matches.payment_window_minutes is
  'Minutos que se reserva el cupo en PENDING_PAYMENT al anotarse. Default 30.';

-- -----------------------------------------------------------------------------
-- 1. Schema privado para helpers internos
-- -----------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. is_admin(): segunda capa de autorización (la primera es ADMIN_EMAIL en Next)
-- -----------------------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. Helpers privados
-- -----------------------------------------------------------------------------

-- Exige usuario autenticado y devuelve su id.
create function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Tenés que iniciar sesión.';
  end if;
  return v_uid;
end;
$$;

-- Exige admin y devuelve su id.
create function private.require_admin()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using hint = 'Acción reservada al administrador.';
  end if;
  return v_uid;
end;
$$;

-- Registra una acción del admin.
create function private.log_admin_action(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_details     jsonb default null
)
returns void
language sql
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, details)
  values (auth.uid(), lower(auth.jwt() ->> 'email'), p_action, p_entity_type, p_entity_id, p_details);
$$;

-- Cupos ocupados: CONFIRMED, PENDING_REVIEW y PENDING_PAYMENT con plazo vigente.
-- Llamar con el partido ya bloqueado (select ... for update) para que el conteo sea confiable.
create function private.occupied_slots(p_match_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.registrations r
  where r.match_id = p_match_id
    and (
      r.status in ('CONFIRMED', 'PENDING_REVIEW')
      or (r.status = 'PENDING_PAYMENT' and r.payment_deadline > now())
    );
$$;

-- Pasa a CANCELLED las PENDING_PAYMENT vencidas de un partido. Devuelve cuántas.
create function private.expire_pending_payments(p_match_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.registrations
     set status = 'CANCELLED',
         cancelled_at = now(),
         cancellation_reason = 'Plazo vencido'
   where match_id = p_match_id
     and status = 'PENDING_PAYMENT'
     and payment_deadline <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Bloquea el partido y lo devuelve (o falla si no existe).
create function private.lock_match(p_match_id uuid)
returns public.matches
language plpgsql
set search_path = ''
as $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'MATCH_NOT_FOUND' using hint = 'El partido no existe.';
  end if;
  return v_match;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Jugador: anotarse
-- -----------------------------------------------------------------------------

create function public.register_for_match(p_match_id uuid)
returns public.registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := private.require_user();
  v_match   public.matches;
  v_pay     public.payment_settings;
  v_reg     public.registrations;
begin
  -- Lock del partido: serializa todas las inscripciones a este partido.
  v_match := private.lock_match(p_match_id);

  if v_match.status <> 'OPEN' then
    raise exception 'MATCH_NOT_OPEN' using hint = 'El partido no está abierto a inscripciones.';
  end if;
  if v_match.starts_at <= now() then
    raise exception 'MATCH_ALREADY_STARTED' using hint = 'El partido ya empezó.';
  end if;

  select * into v_pay from public.payment_settings where is_active;
  if not found then
    raise exception 'NO_ACTIVE_PAYMENT_METHOD' using hint = 'No hay un medio de pago activo. Avisale al administrador.';
  end if;

  -- Liberar reservas vencidas antes de contar (y permitir re-anotarse a quien se le venció).
  perform private.expire_pending_payments(p_match_id);

  if exists (
    select 1 from public.registrations
    where match_id = p_match_id and user_id = v_uid
      and status not in ('REJECTED', 'CANCELLED')
  ) then
    raise exception 'ALREADY_REGISTERED' using hint = 'Ya estás anotado en este partido.';
  end if;

  if private.occupied_slots(p_match_id) < v_match.max_players then
    insert into public.registrations (
      match_id, user_id, status, price_snapshot,
      payment_provider_snapshot, payment_alias_snapshot, payment_account_snapshot, payment_holder_snapshot,
      payment_deadline
    ) values (
      p_match_id, v_uid, 'PENDING_PAYMENT', v_match.price,
      v_pay.provider, v_pay.alias, v_pay.account_number, v_pay.holder_name,
      now() + make_interval(mins => v_match.payment_window_minutes)
    )
    returning * into v_reg;
  else
    insert into public.registrations (match_id, user_id, status, price_snapshot, waitlisted_at)
    values (p_match_id, v_uid, 'WAITLIST', v_match.price, now())
    returning * into v_reg;
  end if;

  return v_reg;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Jugador: enviar comprobante
-- -----------------------------------------------------------------------------

create function public.submit_receipt(p_registration_id uuid, p_receipt_path text)
returns public.registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_reg public.registrations;
begin
  select * into v_reg from public.registrations where id = p_registration_id for update;
  -- Si no es del usuario, respondemos "no existe" para no filtrar información.
  if not found or v_reg.user_id <> v_uid then
    raise exception 'REGISTRATION_NOT_FOUND' using hint = 'La inscripción no existe.';
  end if;

  if v_reg.status <> 'PENDING_PAYMENT' then
    raise exception 'INVALID_STATUS' using hint = 'Esta inscripción no está esperando un comprobante.';
  end if;
  if v_reg.payment_deadline <= now() then
    raise exception 'PAYMENT_DEADLINE_EXPIRED' using hint = 'Se venció el plazo para pagar. Volvé a anotarte.';
  end if;

  -- La ruta tiene que estar dentro de la carpeta del usuario y de esta inscripción.
  if p_receipt_path is null
     or left(p_receipt_path, length(v_uid::text || '/' || v_reg.id::text || '/'))
        <> v_uid::text || '/' || v_reg.id::text || '/'
     or length(p_receipt_path) > 300
     or position('..' in p_receipt_path) > 0 then
    raise exception 'INVALID_RECEIPT_PATH' using hint = 'La ruta del comprobante no es válida.';
  end if;

  -- El archivo tiene que existir realmente en Storage (bucket creado en 004_storage.sql).
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'receipts' and o.name = p_receipt_path
  ) then
    raise exception 'RECEIPT_NOT_FOUND' using hint = 'No encontramos el archivo del comprobante.';
  end if;

  update public.registrations
     set status = 'PENDING_REVIEW',
         receipt_path = p_receipt_path,
         receipt_submitted_at = now()
   where id = v_reg.id
  returning * into v_reg;

  return v_reg;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Cancelar inscripción (dueño o admin)
-- -----------------------------------------------------------------------------

create function public.cancel_registration(p_registration_id uuid, p_reason text default null)
returns public.registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_user();
  v_is_admin boolean := public.is_admin();
  v_reg      public.registrations;
  v_old      public.registration_status;
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_reg from public.registrations where id = p_registration_id for update;
  if not found or (v_reg.user_id <> v_uid and not v_is_admin) then
    raise exception 'REGISTRATION_NOT_FOUND' using hint = 'La inscripción no existe.';
  end if;

  if v_reg.status in ('REJECTED', 'CANCELLED') then
    raise exception 'INVALID_STATUS' using hint = 'La inscripción ya no está activa.';
  end if;

  if v_reason is null then
    v_reason := case when v_reg.user_id = v_uid
                     then 'Cancelada por el jugador'
                     else 'Cancelada por el administrador' end;
  end if;

  v_old := v_reg.status;

  update public.registrations
     set status = 'CANCELLED',
         cancelled_at = now(),
         cancellation_reason = left(v_reason, 500)
   where id = v_reg.id
  returning * into v_reg;

  if v_reg.user_id <> v_uid then
    perform private.log_admin_action('CANCEL_REGISTRATION', 'registration', v_reg.id,
      jsonb_build_object('previous_status', v_old, 'reason', v_reason));
  end if;

  return v_reg;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Admin: aprobar / rechazar pago
-- -----------------------------------------------------------------------------

create function public.approve_payment(p_registration_id uuid)
returns public.registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_reg public.registrations;
begin
  select * into v_reg from public.registrations where id = p_registration_id for update;
  if not found then
    raise exception 'REGISTRATION_NOT_FOUND' using hint = 'La inscripción no existe.';
  end if;
  if v_reg.status <> 'PENDING_REVIEW' then
    raise exception 'INVALID_STATUS' using hint = 'Solo se aprueban pagos en revisión.';
  end if;

  update public.registrations
     set status = 'CONFIRMED',
         confirmed_at = now(),
         reviewed_at = now(),
         reviewed_by = v_uid
   where id = v_reg.id
  returning * into v_reg;

  perform private.log_admin_action('APPROVE_PAYMENT', 'registration', v_reg.id, null);
  return v_reg;
end;
$$;

create function public.reject_payment(p_registration_id uuid, p_reason text)
returns public.registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := private.require_admin();
  v_reg    public.registrations;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null then
    raise exception 'REASON_REQUIRED' using hint = 'Indicá el motivo del rechazo.';
  end if;

  select * into v_reg from public.registrations where id = p_registration_id for update;
  if not found then
    raise exception 'REGISTRATION_NOT_FOUND' using hint = 'La inscripción no existe.';
  end if;
  if v_reg.status <> 'PENDING_REVIEW' then
    raise exception 'INVALID_STATUS' using hint = 'Solo se rechazan pagos en revisión.';
  end if;

  update public.registrations
     set status = 'REJECTED',
         rejection_reason = left(v_reason, 500),
         reviewed_at = now(),
         reviewed_by = v_uid
   where id = v_reg.id
  returning * into v_reg;

  perform private.log_admin_action('REJECT_PAYMENT', 'registration', v_reg.id,
    jsonb_build_object('reason', v_reason));
  return v_reg;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Admin: suplentes y vencimientos
-- -----------------------------------------------------------------------------

-- Promueve al suplente más antiguo a PENDING_PAYMENT. p_deadline null = plazo del partido.
create function public.promote_from_waitlist(p_match_id uuid, p_deadline timestamptz default null)
returns public.registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_admin();
  v_match    public.matches;
  v_pay      public.payment_settings;
  v_reg      public.registrations;
  v_deadline timestamptz;
begin
  v_match := private.lock_match(p_match_id);

  if v_match.status not in ('OPEN', 'CLOSED') then
    raise exception 'INVALID_STATUS' using hint = 'El partido no admite cambios en la lista.';
  end if;

  v_deadline := coalesce(p_deadline, now() + make_interval(mins => v_match.payment_window_minutes));
  if v_deadline <= now() then
    raise exception 'INVALID_DEADLINE' using hint = 'El plazo tiene que ser una fecha futura.';
  end if;

  select * into v_pay from public.payment_settings where is_active;
  if not found then
    raise exception 'NO_ACTIVE_PAYMENT_METHOD' using hint = 'Activá un medio de pago antes de promover.';
  end if;

  perform private.expire_pending_payments(p_match_id);

  if private.occupied_slots(p_match_id) >= v_match.max_players then
    raise exception 'NO_SLOTS_AVAILABLE' using hint = 'No hay cupo libre para promover a un suplente.';
  end if;

  select * into v_reg
  from public.registrations
  where match_id = p_match_id and status = 'WAITLIST'
  order by waitlisted_at, created_at
  limit 1
  for update;
  if not found then
    raise exception 'WAITLIST_EMPTY' using hint = 'No hay suplentes.';
  end if;

  -- Snapshot nuevo: precio y datos de pago vigentes al momento de la promoción.
  update public.registrations
     set status = 'PENDING_PAYMENT',
         price_snapshot = v_match.price,
         payment_provider_snapshot = v_pay.provider,
         payment_alias_snapshot = v_pay.alias,
         payment_account_snapshot = v_pay.account_number,
         payment_holder_snapshot = v_pay.holder_name,
         payment_deadline = v_deadline
   where id = v_reg.id
  returning * into v_reg;

  perform private.log_admin_action('PROMOTE_FROM_WAITLIST', 'registration', v_reg.id,
    jsonb_build_object('match_id', p_match_id, 'deadline', v_deadline));
  return v_reg;
end;
$$;

-- Libera manualmente las reservas vencidas de un partido. Devuelve cuántas.
-- (Mejora futura: correrlo automático con pg_cron.)
create function public.expire_pending_payments(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_admin();
  v_count integer;
begin
  perform private.lock_match(p_match_id);
  v_count := private.expire_pending_payments(p_match_id);
  if v_count > 0 then
    perform private.log_admin_action('EXPIRE_PENDING_PAYMENTS', 'match', p_match_id,
      jsonb_build_object('expired', v_count));
  end if;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Lista pública del partido (sin email ni datos de pago)
-- -----------------------------------------------------------------------------

-- grupo: CONFIRMED | PENDING (en revisión o con reserva vigente) | WAITLIST (en orden de llegada)
create function public.get_match_roster(p_match_id uuid)
returns table (
  full_name  text,
  avatar_url text,
  "position" public.player_position,
  grupo      text,
  orden      integer,
  is_me      boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid    uuid := private.require_user();
  v_status public.match_status;
begin
  select m.status into v_status from public.matches m where m.id = p_match_id;
  if not found or (v_status = 'DRAFT' and not public.is_admin()) then
    raise exception 'MATCH_NOT_FOUND' using hint = 'El partido no existe.';
  end if;

  return query
  with activos as (
    select r.*,
           case
             when r.status = 'CONFIRMED' then 'CONFIRMED'
             when r.status = 'PENDING_REVIEW'
               or (r.status = 'PENDING_PAYMENT' and r.payment_deadline > now()) then 'PENDING'
             when r.status = 'WAITLIST' then 'WAITLIST'
           end as g
    from public.registrations r
    where r.match_id = p_match_id
  )
  select p.full_name,
         p.avatar_url,
         p.position,
         a.g,
         (row_number() over (
            partition by a.g
            order by case when a.g = 'WAITLIST' then a.waitlisted_at else a.created_at end, a.created_at
         ))::integer,
         a.user_id = v_uid
  from activos a
  join public.profiles p on p.id = a.user_id
  where a.g is not null
  order by case a.g when 'CONFIRMED' then 1 when 'PENDING' then 2 else 3 end, 5;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Admin: partidos
-- -----------------------------------------------------------------------------
-- Decisión: las escrituras del admin van por funciones (no por políticas RLS de
-- INSERT/UPDATE) porque así cada cambio queda validado y auditado en la misma
-- transacción, y no hay forma de saltear el audit_log desde la API.
-- La LECTURA del admin sí va por RLS (003_rls.sql), porque es más simple de consultar.

create function public.admin_create_match(
  p_title                  text,
  p_location               text,
  p_starts_at              timestamptz,
  p_ends_at                timestamptz,
  p_price                  integer,
  p_max_players            integer,
  p_payment_window_minutes integer default 30,
  p_notes                  text default null
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_admin();
  v_match public.matches;
begin
  if p_starts_at <= now() then
    raise exception 'INVALID_DATE' using hint = 'La fecha del partido tiene que ser futura.';
  end if;

  insert into public.matches (title, location, starts_at, ends_at, price, max_players,
                              payment_window_minutes, notes, status)
  values (btrim(p_title), btrim(p_location), p_starts_at, p_ends_at, p_price, p_max_players,
          p_payment_window_minutes, nullif(btrim(coalesce(p_notes, '')), ''), 'DRAFT')
  returning * into v_match;

  perform private.log_admin_action('CREATE_MATCH', 'match', v_match.id, to_jsonb(v_match));
  return v_match;
end;
$$;

create function public.admin_update_match(
  p_match_id               uuid,
  p_title                  text,
  p_location               text,
  p_starts_at              timestamptz,
  p_ends_at                timestamptz,
  p_price                  integer,
  p_max_players            integer,
  p_payment_window_minutes integer,
  p_notes                  text default null
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_admin();
  v_old   public.matches;
  v_match public.matches;
begin
  v_old := private.lock_match(p_match_id);

  if v_old.status in ('PLAYED', 'CANCELLED') then
    raise exception 'INVALID_STATUS' using hint = 'No se puede editar un partido jugado o cancelado.';
  end if;

  perform private.expire_pending_payments(p_match_id);
  if p_max_players < private.occupied_slots(p_match_id) then
    raise exception 'MAX_PLAYERS_BELOW_OCCUPIED'
      using hint = 'El cupo no puede ser menor a la cantidad de lugares ya ocupados.';
  end if;

  update public.matches
     set title = btrim(p_title),
         location = btrim(p_location),
         starts_at = p_starts_at,
         ends_at = p_ends_at,
         price = p_price,
         max_players = p_max_players,
         payment_window_minutes = p_payment_window_minutes,
         notes = nullif(btrim(coalesce(p_notes, '')), '')
   where id = p_match_id
  returning * into v_match;

  perform private.log_admin_action('UPDATE_MATCH', 'match', p_match_id,
    jsonb_build_object('before', to_jsonb(v_old), 'after', to_jsonb(v_match)));
  return v_match;
end;
$$;

-- Transiciones permitidas:
--   DRAFT  → OPEN | CANCELLED
--   OPEN   → CLOSED | PLAYED | CANCELLED
--   CLOSED → OPEN | PLAYED | CANCELLED
--   PLAYED y CANCELLED son finales.
-- Al cancelar, todas las inscripciones activas pasan a CANCELLED ("Partido suspendido").
create function public.admin_set_match_status(p_match_id uuid, p_status public.match_status)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := private.require_admin();
  v_old       public.matches;
  v_match     public.matches;
  v_cancelled integer := 0;
begin
  v_old := private.lock_match(p_match_id);

  if not (
       (v_old.status = 'DRAFT'  and p_status in ('OPEN', 'CANCELLED'))
    or (v_old.status = 'OPEN'   and p_status in ('CLOSED', 'PLAYED', 'CANCELLED'))
    or (v_old.status = 'CLOSED' and p_status in ('OPEN', 'PLAYED', 'CANCELLED'))
  ) then
    raise exception 'INVALID_TRANSITION'
      using hint = format('No se puede pasar de %s a %s.', v_old.status, p_status);
  end if;

  if p_status = 'OPEN' and v_old.starts_at <= now() then
    raise exception 'MATCH_ALREADY_STARTED' using hint = 'No se puede abrir un partido que ya empezó.';
  end if;

  update public.matches set status = p_status where id = p_match_id
  returning * into v_match;

  if p_status = 'CANCELLED' then
    update public.registrations
       set status = 'CANCELLED',
           cancelled_at = now(),
           cancellation_reason = 'Partido suspendido'
     where match_id = p_match_id
       and status not in ('REJECTED', 'CANCELLED');
    get diagnostics v_cancelled = row_count;
  end if;

  perform private.log_admin_action('SET_MATCH_STATUS', 'match', p_match_id,
    jsonb_build_object('from', v_old.status, 'to', p_status, 'registrations_cancelled', v_cancelled));
  return v_match;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Admin: medios de pago
-- -----------------------------------------------------------------------------

create function public.admin_save_payment_setting(
  p_id             uuid,          -- null = crear uno nuevo
  p_provider       public.payment_provider,
  p_alias          text,
  p_account_number text,
  p_holder_name    text
)
returns public.payment_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := private.require_admin();
  v_account text := regexp_replace(coalesce(p_account_number, ''), '\s', '', 'g');
  v_row     public.payment_settings;
begin
  if nullif(btrim(coalesce(p_alias, '')), '') is null
     or nullif(btrim(coalesce(p_holder_name, '')), '') is null then
    raise exception 'INVALID_PAYMENT_DATA' using hint = 'Completá alias y titular.';
  end if;
  if v_account !~ '^[0-9]{22}$' then
    raise exception 'INVALID_ACCOUNT_NUMBER' using hint = 'El CVU/CBU tiene que tener 22 dígitos.';
  end if;

  if p_id is null then
    insert into public.payment_settings (provider, alias, account_number, holder_name)
    values (p_provider, btrim(p_alias), v_account, btrim(p_holder_name))
    returning * into v_row;
    perform private.log_admin_action('CREATE_PAYMENT_SETTING', 'payment_settings', v_row.id, to_jsonb(v_row));
  else
    update public.payment_settings
       set provider = p_provider,
           alias = btrim(p_alias),
           account_number = v_account,
           holder_name = btrim(p_holder_name)
     where id = p_id
    returning * into v_row;
    if not found then
      raise exception 'PAYMENT_SETTING_NOT_FOUND' using hint = 'El medio de pago no existe.';
    end if;
    perform private.log_admin_action('UPDATE_PAYMENT_SETTING', 'payment_settings', v_row.id, to_jsonb(v_row));
  end if;

  return v_row;
end;
$$;

-- Activa un medio de pago y desactiva el resto (máximo uno activo).
-- Con p_active = false solo lo desactiva.
create function public.admin_set_payment_setting_active(p_id uuid, p_active boolean)
returns public.payment_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_row public.payment_settings;
begin
  -- Lock de todos los medios para que dos activaciones simultáneas no choquen.
  perform 1 from public.payment_settings for update;

  if not exists (select 1 from public.payment_settings where id = p_id) then
    raise exception 'PAYMENT_SETTING_NOT_FOUND' using hint = 'El medio de pago no existe.';
  end if;

  if p_active then
    update public.payment_settings set is_active = false where is_active and id <> p_id;
  end if;

  update public.payment_settings set is_active = p_active where id = p_id
  returning * into v_row;

  perform private.log_admin_action(
    case when p_active then 'ACTIVATE_PAYMENT_SETTING' else 'DEACTIVATE_PAYMENT_SETTING' end,
    'payment_settings', p_id, null);
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. Permisos de ejecución
-- -----------------------------------------------------------------------------
-- Supabase da EXECUTE a anon por defecto en funciones nuevas de public: se lo sacamos.

revoke execute on all functions in schema private from public, anon, authenticated;

revoke execute on function public.is_admin()                                         from public, anon;
revoke execute on function public.register_for_match(uuid)                           from public, anon;
revoke execute on function public.submit_receipt(uuid, text)                         from public, anon;
revoke execute on function public.cancel_registration(uuid, text)                    from public, anon;
revoke execute on function public.approve_payment(uuid)                              from public, anon;
revoke execute on function public.reject_payment(uuid, text)                         from public, anon;
revoke execute on function public.promote_from_waitlist(uuid, timestamptz)           from public, anon;
revoke execute on function public.expire_pending_payments(uuid)                      from public, anon;
revoke execute on function public.get_match_roster(uuid)                             from public, anon;
revoke execute on function public.admin_create_match(text, text, timestamptz, timestamptz, integer, integer, integer, text)       from public, anon;
revoke execute on function public.admin_update_match(uuid, text, text, timestamptz, timestamptz, integer, integer, integer, text) from public, anon;
revoke execute on function public.admin_set_match_status(uuid, public.match_status)  from public, anon;
revoke execute on function public.admin_save_payment_setting(uuid, public.payment_provider, text, text, text) from public, anon;
revoke execute on function public.admin_set_payment_setting_active(uuid, boolean)    from public, anon;
revoke execute on function public.set_updated_at()                                   from public, anon, authenticated;

grant execute on function public.is_admin()                                         to authenticated;
grant execute on function public.register_for_match(uuid)                           to authenticated;
grant execute on function public.submit_receipt(uuid, text)                         to authenticated;
grant execute on function public.cancel_registration(uuid, text)                    to authenticated;
grant execute on function public.approve_payment(uuid)                              to authenticated;
grant execute on function public.reject_payment(uuid, text)                         to authenticated;
grant execute on function public.promote_from_waitlist(uuid, timestamptz)           to authenticated;
grant execute on function public.expire_pending_payments(uuid)                      to authenticated;
grant execute on function public.get_match_roster(uuid)                             to authenticated;
grant execute on function public.admin_create_match(text, text, timestamptz, timestamptz, integer, integer, integer, text)       to authenticated;
grant execute on function public.admin_update_match(uuid, text, text, timestamptz, timestamptz, integer, integer, integer, text) to authenticated;
grant execute on function public.admin_set_match_status(uuid, public.match_status)  to authenticated;
grant execute on function public.admin_save_payment_setting(uuid, public.payment_provider, text, text, text) to authenticated;
grant execute on function public.admin_set_payment_setting_active(uuid, boolean)    to authenticated;

commit;
