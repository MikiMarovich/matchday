-- =============================================================================
-- MATCHDAY — 007_join_waitlist.sql
-- Suplente voluntario: el jugador se anota como suplente aunque haya lugar,
-- sin pagar ni ocupar cupo (decidido por Mikael el 2026-11-04).
--
-- Entra a la misma fila de suplentes, por orden de llegada (waitlisted_at).
-- Para jugar: el admin lo promueve (promote_from_waitlist) o el jugador cancela
-- la suplencia y se anota con lugar (register_for_match).
-- =============================================================================

begin;

create function public.join_waitlist(p_match_id uuid)
returns public.registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_user();
  v_match public.matches;
  v_reg   public.registrations;
begin
  -- Mismo lock que register_for_match: serializa con las demás inscripciones.
  v_match := private.lock_match(p_match_id);

  if v_match.status <> 'OPEN' then
    raise exception 'MATCH_NOT_OPEN' using hint = 'El partido no está abierto a inscripciones.';
  end if;
  if v_match.starts_at <= now() then
    raise exception 'MATCH_ALREADY_STARTED' using hint = 'El partido ya empezó.';
  end if;

  -- Liberar reservas vencidas (permite volver a anotarse a quien se le venció).
  perform private.expire_pending_payments(p_match_id);

  if exists (
    select 1 from public.registrations
    where match_id = p_match_id and user_id = v_uid
      and status not in ('REJECTED', 'CANCELLED')
  ) then
    raise exception 'ALREADY_REGISTERED' using hint = 'Ya estás anotado en este partido.';
  end if;

  insert into public.registrations (match_id, user_id, status, price_snapshot, waitlisted_at)
  values (p_match_id, v_uid, 'WAITLIST', v_match.price, now())
  returning * into v_reg;

  return v_reg;
end;
$$;

revoke execute on function public.join_waitlist(uuid) from public, anon;
grant  execute on function public.join_waitlist(uuid) to authenticated;

commit;
