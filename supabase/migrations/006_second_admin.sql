-- =============================================================================
-- MATCHDAY — 006_second_admin.sql
-- 1. Segundo administrador.
-- 2. El aviso de comprobante se manda a TODOS los admins: el registro pasa a ser
--    una fila por destinatario. El destinatario lo indica el servidor, pero la
--    función exige que esté en public.admins (no se puede registrar a cualquiera).
-- =============================================================================

begin;

-- 1. Segundo admin (el check de la tabla exige minúsculas).
insert into public.admins (email) values ('agulosgigantes1@gmail.com')
on conflict (email) do nothing;

-- 2. Reemplazo de log_receipt_notification (cambia la firma: se agrega p_recipient).
drop function public.log_receipt_notification(uuid, text, text, text);

create function public.log_receipt_notification(
  p_registration_id uuid,
  p_recipient       text,
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
  v_recipient text := lower(btrim(coalesce(p_recipient, '')));
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

  -- Solo se registran avisos a administradores reales.
  if not exists (select 1 from public.admins where email = v_recipient) then
    raise exception 'INVALID_RECIPIENT' using hint = 'El destinatario no es administrador.';
  end if;

  -- Ya se le avisó con éxito a este admin por esta inscripción: no duplicar.
  if exists (
    select 1 from public.notifications_log
    where registration_id = p_registration_id and type = 'RECEIPT_SUBMITTED'
      and status = 'SENT' and recipient_email = v_recipient
  ) then
    return;
  end if;

  insert into public.notifications_log (registration_id, recipient_email, type, status, provider_message_id, error)
  values (p_registration_id, v_recipient, 'RECEIPT_SUBMITTED', p_status,
          left(p_message_id, 300), left(p_error, 500));
end;
$$;

revoke execute on function public.log_receipt_notification(uuid, text, text, text, text) from public, anon;
grant  execute on function public.log_receipt_notification(uuid, text, text, text, text) to authenticated;

commit;
