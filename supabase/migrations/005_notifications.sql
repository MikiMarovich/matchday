-- =============================================================================
-- MATCHDAY — 005_notifications.sql
-- Registro del email al admin cuando un jugador envía su comprobante.
--
-- El email lo manda el servidor Next (Gmail SMTP) con la sesión del JUGADOR, que no
-- puede escribir en notifications_log (solo lectura del admin, 003_rls.sql). Esta
-- función es la única puerta de escritura y está acotada para que no se pueda abusar:
--   * solo el dueño de la inscripción (o el admin),
--   * solo si la inscripción está en PENDING_REVIEW (ya envió el comprobante),
--   * a lo sumo un registro SENT por inscripción (idempotente: no se puede inflar el log),
--   * el destinatario NO lo elige quien llama: es el email de public.admins.
-- =============================================================================

begin;

create function public.log_receipt_notification(
  p_registration_id uuid,
  p_status          text,             -- 'SENT' | 'FAILED'
  p_message_id      text default null,
  p_error           text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := private.require_user();
  v_reg       public.registrations;
  v_recipient text;
begin
  if p_status not in ('SENT', 'FAILED') then
    raise exception 'INVALID_STATUS' using hint = 'Estado de notificación inválido.';
  end if;

  select * into v_reg from public.registrations where id = p_registration_id;
  if not found or (v_reg.user_id <> v_uid and not public.is_admin()) then
    raise exception 'REGISTRATION_NOT_FOUND' using hint = 'La inscripción no existe.';
  end if;
  if v_reg.status <> 'PENDING_REVIEW' then
    raise exception 'INVALID_STATUS' using hint = 'La inscripción no tiene un comprobante en revisión.';
  end if;

  -- Ya se avisó con éxito: no duplicar.
  if exists (
    select 1 from public.notifications_log
    where registration_id = p_registration_id and type = 'RECEIPT_SUBMITTED' and status = 'SENT'
  ) then
    return;
  end if;

  select email into v_recipient from public.admins order by email limit 1;
  if v_recipient is null then
    raise exception 'NO_ADMIN' using hint = 'No hay un administrador configurado.';
  end if;

  insert into public.notifications_log (registration_id, recipient_email, type, status, provider_message_id, error)
  values (p_registration_id, v_recipient, 'RECEIPT_SUBMITTED', p_status,
          left(p_message_id, 300), left(p_error, 500));
end;
$$;

revoke execute on function public.log_receipt_notification(uuid, text, text, text) from public, anon;
grant  execute on function public.log_receipt_notification(uuid, text, text, text) to authenticated;

commit;
