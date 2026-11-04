-- =============================================================================
-- MATCHDAY — 003_rls.sql
-- Políticas de Row Level Security y permisos de tabla.
--
-- Criterios:
--   * Solo LECTURA por RLS. Todas las escrituras pasan por las funciones del 002
--     (security definer), así que a la API no se le da INSERT/UPDATE/DELETE,
--     salvo UPDATE de full_name y position en el propio perfil.
--   * anon (usuario sin sesión) no lee ninguna tabla.
--   * auth.uid() e is_admin() van envueltos en (select ...) para que Postgres
--     los evalúe una vez por consulta y no una vez por fila.
--
-- Ejecutar completo en Supabase → SQL Editor. Corre en una sola transacción.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Permisos de tabla (capa previa a RLS)
-- -----------------------------------------------------------------------------
-- Supabase da por defecto todos los permisos a anon y authenticated en tablas
-- nuevas de public. Los recortamos a lo mínimo.

revoke all on table
  public.profiles, public.matches, public.payment_settings, public.registrations,
  public.notifications_log, public.audit_logs, public.admins
from anon, authenticated;

grant select on table
  public.profiles, public.matches, public.payment_settings, public.registrations,
  public.notifications_log, public.audit_logs
to authenticated;

-- El jugador solo puede editar su nombre y su posición (permiso por columna).
grant update (full_name, position) on table public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- 2. profiles
-- -----------------------------------------------------------------------------

create policy "profiles: ver el propio o admin"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "profiles: editar el propio"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 3. matches
-- -----------------------------------------------------------------------------

create policy "matches: publicados para todos, borradores solo admin"
  on public.matches for select
  to authenticated
  using (status <> 'DRAFT' or (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- 4. payment_settings
-- -----------------------------------------------------------------------------
-- Solo el admin. El jugador recibe los datos de transferencia en el snapshot de
-- SU inscripción (registrations.payment_*_snapshot), recién cuando tiene el cupo
-- reservado. Así nadie ve el alias/CVU sin tener lugar asegurado.

create policy "payment_settings: solo admin"
  on public.payment_settings for select
  to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- 5. registrations
-- -----------------------------------------------------------------------------
-- Sin políticas de INSERT/UPDATE/DELETE: todo pasa por funciones.

create policy "registrations: ver las propias o admin"
  on public.registrations for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- 6. notifications_log y audit_logs: solo lectura del admin
-- -----------------------------------------------------------------------------

create policy "notifications_log: solo admin"
  on public.notifications_log for select
  to authenticated
  using ((select public.is_admin()));

create policy "audit_logs: solo admin"
  on public.audit_logs for select
  to authenticated
  using ((select public.is_admin()));

-- admins: sin políticas y sin permisos. Invisible para la API.

commit;
