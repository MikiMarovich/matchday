-- =============================================================================
-- MATCHDAY — 004_storage.sql
-- Bucket privado de comprobantes y sus políticas.
--
-- Ruta de cada archivo: {user_id}/{registration_id}/{archivo}
--   ej: 6f1c.../a93b.../comprobante-1730671234.jpg
--
-- Reglas:
--   * Bucket privado: nada es accesible por URL pública.
--   * Límite 5 MB y solo JPG, PNG, WEBP o PDF (lo controla la API de Storage).
--   * El jugador sube SOLO dentro de su carpeta y SOLO para una inscripción suya
--     que esté esperando el pago (PENDING_PAYMENT con plazo vigente).
--   * El jugador ve sus comprobantes; el admin ve todos (signed URLs desde el
--     servidor con la sesión del admin, sin secret key).
--   * Sin UPDATE ni DELETE: un comprobante subido no se puede pisar ni borrar.
--     El frontend debe subir con upsert: false y un nombre único por archivo.
--
-- Ejecutar completo en Supabase → SQL Editor, UNA sola vez.
-- =============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

create policy "receipts: subir en carpeta propia con inscripción pendiente de pago"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.registrations r
      where r.id::text = (storage.foldername(name))[2]
        and r.user_id = (select auth.uid())
        and r.status = 'PENDING_PAYMENT'
        and r.payment_deadline > now()
    )
  );

create policy "receipts: ver los propios o admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_admin())
    )
  );

commit;
