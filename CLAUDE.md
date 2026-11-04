# MATCHDAY — Contexto para Claude Code

App web para organizar partidos de fútbol de un grupo de amigos: portal de jugadores + backoffice de un único administrador.
El documento original de requerimientos (`docs/contexto-matchday.md`) **se perdió y no existe**. Este CLAUDE.md es la única fuente: no vuelvas a relevar lo que ya está definido acá, y ante lo que no esté cubierto, preguntale a Mikael.

Usuario: Mikael, analista funcional con conocimientos de Python, JavaScript y MySQL. Respondé en español rioplatense, con terminología técnica pero explicando configuraciones y decisiones de arquitectura.

## Reglas de trabajo

- Una etapa por vez: implementar, verificar con Mikael y recién después avanzar. Nada de diez tareas juntas.
- Antes de modificar un archivo importante, leelo. No reconstruyas lo que ya funciona.
- No asumas que una integración está configurada si no se verificó.
- Lógica crítica (cupos, estados, permisos) siempre en la base de datos o en el servidor, nunca solo en el frontend.
- Nunca exponer la secret key / service_role en el cliente ni en variables `NEXT_PUBLIC_`.
- Priorizar herramientas gratuitas. No integrar APIs de cobro de Mercado Pago ni Naranja X.
- Sin datos ficticios en producción. Sin botones sin funcionalidad.
- Cambios de esquema: siempre como archivo nuevo en `supabase/migrations/NNN_nombre.sql`, que Mikael ejecuta en Supabase → SQL Editor. El MCP de Supabase está en modo **read_only**: usalo para consultar y verificar, no para modificar.
- Al terminar cada paso, indicá qué probar y qué resultado esperar.

## Stack real (verificado en el repo)

- Next.js **16.4.3** con App Router y Turbopack. La protección de rutas va en **`proxy.ts`** (no `middleware.ts`).
- React 19, TypeScript 5.7, `strict: true`.
- Tailwind CSS **v4**, configurado en CSS (`@theme` en `app/globals.css`), sin `tailwind.config`.
- shadcn/ui con estilo **`base-nova`** sobre `@base-ui/react` (no Radix). Instalar componentes nuevos con el CLI de shadcn respetando ese estilo.
- Lucide icons, `@vercel/analytics`, pnpm.
- Vercel ya está conectado al repo y despliega automáticamente en cada push.
- Supabase: proyecto creado, ref `uwputddqhhgcwrcetlci`.

## Estado del frontend (revisión de Etapa 1)

- Todo está en `app/page.tsx` (`'use client'`). La navegación es un `useState`, no hay rutas reales.
- Login falso (`logged` arranca en `true`). El backoffice se abre con `setAdmin(true)` desde un link visible para todos los jugadores: debe desaparecer y pasar a `/admin`, protegido del lado servidor.
- Todos los datos son mock (Juan Cruz, Club Atlético Palermo, CVU inventado).
- Estilos: casi todo en clases CSS propias dentro de `globals.css` (minificado), con la paleta como variables. **Mantener la identidad visual**, no reescribir a Tailwind por gusto. Ordenar el CSS a medida que se separen componentes.
- Problemas puntuales:
  - "Enviar comprobante" funciona sin archivo y no valida tipo ni tamaño.
  - Falta la lista pública de pendientes de revisión.
  - Falta el selector de posición en el perfil.
  - Las cinco secciones del admin muestran la misma tabla genérica.
  - Configuración no existe.
  - El dashboard muestra métricas distintas a las pedidas y un "+12.5%" inventado.
- **Responsive**: el lado jugador funciona. El backoffice queda **inutilizable en mobile**, porque `.admin-sidebar { display: none }` bajo 800px no tiene reemplazo. Hay que agregar un drawer o una nav inferior.
- Fuente: Arial (no se carga ninguna). Mejorar luego con `next/font`.
- Correcciones aplicadas (2026-11-03): se quitó `typescript.ignoreBuildErrors` de `next.config.mjs`; `viewport` en `app/layout.tsx` quedó con `colorScheme: 'dark'` y `themeColor: '#101820'`.

## Base de datos

`supabase/migrations/001_schema.sql` **aplicado y verificado por MCP (2026-11-03)**: 7 tablas con RLS activo y sin políticas, 4 enums, trigger `on_auth_user_created`, y una fila en `admins` (`dmmarovich4@gmail.com`, la cuenta de Google con la que entra Mikael). Fue reescrito desde las decisiones de este archivo porque el original se perdió.

Decisiones ya tomadas en el 001:

- `player_position`: ARQUERO, DEFENSOR, MEDIOCAMPISTA, DELANTERO (confirmado por Mikael).
- `payment_settings.account_number` exige 22 dígitos (CVU/CBU). Alias, CVU, titular, y los datos del partido (título, lugar, horarios, precio, cupo, notas) los edita el admin desde el backoffice.

- Enums: `player_position`, `match_status` (DRAFT, OPEN, CLOSED, PLAYED, CANCELLED), `registration_status` (los 6 estados del requerimiento) y `payment_provider` (MERCADO_PAGO, NARANJA_X).
- Sin columna `role` en `profiles`. Los admins están en la tabla `public.admins` (email), invisible para la API.
- La autorización admin tiene dos capas: `ADMIN_EMAIL` en el servidor Next y `public.is_admin()` en la base.
- `matches.starts_at timestamptz` y `ends_at` opcional. `price` es `integer` (pesos enteros). `max_players` va de 2 a 50.
- `registrations`:
  - Guarda snapshots de pago (método, alias, cuenta, titular).
  - El orden de suplentes sale de `waitlisted_at`; no hay `waitlist_position`.
  - Hay constraints de consistencia por estado.
  - Un índice único parcial impide dos inscripciones activas del mismo usuario en el mismo partido. Tras REJECTED o CANCELLED se puede volver a inscribir.
- `payment_settings`: máximo un medio activo a la vez, por índice único parcial.
- El trigger `on_auth_user_created` crea el perfil desde los metadatos de Google.
- RLS está activado en todo y **todavía no hay políticas**.

## Flujo de inscripción (confirmado por Mikael el 2026-11-03)

Para que nadie transfiera sin tener lugar asegurado:

1. "Anotarme" ejecuta `register_for_match`. Si hay cupo, crea la inscripción en **PENDING_PAYMENT** con `payment_deadline` (plazo configurable) y **ocupa el cupo hasta que vence el plazo**. Si no hay cupo, la crea en **WAITLIST**, sin pago.
2. Recién con el lugar reservado se muestran los datos de transferencia. El jugador transfiere y adjunta el comprobante: `submit_receipt` pasa la inscripción a **PENDING_REVIEW**.
3. Ocupan cupo: CONFIRMED, PENDING_REVIEW y PENDING_PAYMENT con plazo vigente.

Plazo por defecto de PENDING_PAYMENT: **30 minutos** (configurable). Al promover un suplente, el admin define el plazo.

## Pendientes, en orden

### Paso 1 — Verificación inicial ✅ (completado 2026-11-03)

### Paso 2 — `002_functions.sql` ✅ (aplicado y verificado 2026-11-03)

Estado: aplicado en Supabase, verificado por MCP, 40 pruebas funcionales en PGlite y prueba de concurrencia real (`scripts/test-concurrency.mjs`, requiere `DATABASE_URL` del Session pooler en `.env.local`) en verde.
Decisiones tomadas en el 002:
- `matches.payment_window_minutes` (default 30, entre 5 y 1440): plazo de reserva por partido.
- Helpers internos en el schema `private` (no expuesto por la API).
- Escrituras del admin solo por funciones `admin_*` (validan y auditan en la misma transacción). La lectura admin irá por RLS en el 003.
- Errores: el mensaje es un código estable (`MATCH_NOT_OPEN`, `ALREADY_REGISTERED`, etc.) y el HINT trae el texto en español.
- Cancelar un partido cancela sus inscripciones activas ("Partido suspendido").
- `submit_receipt` verifica que el archivo exista en `storage.objects` (bucket `receipts`).
- `get_match_roster` devuelve `full_name, avatar_url, position, grupo (CONFIRMED|PENDING|WAITLIST), orden, is_me`.

Especificación original:
Todas las funciones `security definer`, con `set search_path = ''`, `revoke execute ... from anon` y validación interna de permisos. Las acciones admin escriben en `audit_logs`.

- `is_admin()`: compara el email del JWT con `public.admins`.
- `register_for_match(match_id)`:
  - Hace `select ... for update` sobre el partido (atomicidad).
  - Exige `status = 'OPEN'` y un `payment_settings` activo.
  - Cuenta los cupos ocupados y crea la inscripción en PENDING_PAYMENT o WAITLIST, con snapshots del precio y de los datos de pago.
- `submit_receipt(registration_id, receipt_path)`: solo el dueño, desde PENDING_PAYMENT con plazo vigente.
- `approve_payment(registration_id)` y `reject_payment(registration_id, reason)`: solo admin, desde PENDING_REVIEW. Rechazar libera el cupo.
- `cancel_registration(registration_id, reason)`: el dueño o el admin. Registra la fecha y el motivo (si el jugador no da motivo, se usa uno por defecto).
- `promote_from_waitlist(match_id, deadline)`: solo admin. Toma el suplente más antiguo, verifica el cupo con lock y lo pasa a PENDING_PAYMENT con un snapshot nuevo de los datos de pago.
- `expire_pending_payments(match_id)`: libera las PENDING_PAYMENT vencidas (las marca CANCELLED con motivo "Plazo vencido"). Es ejecutable por el admin. Evaluar `pg_cron` (disponible gratis) como mejora posterior.
- `get_match_roster(match_id)`: devuelve solo nombre, avatar, posición y grupo (confirmados, pendientes, suplentes en orden). **Nunca** email ni datos de pago.
- Admin: crear, editar, cancelar, abrir y cerrar partidos, y gestionar `payment_settings`. Puede hacerse con RLS de admin o con funciones; justificá la elección.

Entregá además un script de prueba de concurrencia (por ejemplo, N inscripciones simultáneas contra un partido de capacidad baja) y verificá que nunca se excede `max_players`.

### Paso 3 — `003_rls.sql` ✅ (aplicado y verificado 2026-11-03)

Estado: 7 políticas SELECT (+ UPDATE propio en profiles), permisos de tabla recortados (anon sin acceso, authenticated solo SELECT, UPDATE de profiles solo en `full_name` y `position`). 31 pruebas en PGlite.
Desvío respecto de la especificación: `payment_settings` es **solo admin**; el jugador ve alias/CVU en el snapshot de su inscripción, recién con el cupo reservado.
Avisos esperables del linter de Supabase: `rls_enabled_no_policy` en `admins` (a propósito) y `authenticated_security_definer_function_executable` en las RPC (validan permisos adentro).

Especificación original:
- `profiles`: SELECT del propio perfil o admin. UPDATE solo propio, con column grants limitados a `full_name` y `position`.
- `matches`: SELECT para `authenticated` de los que no son DRAFT; el admin ve todo.
- `payment_settings`: SELECT del activo para `authenticated`; el admin ve y gestiona todo.
- `registrations`: SELECT propio o admin. **Sin** políticas de INSERT, UPDATE ni DELETE: todo pasa por funciones.
- `notifications_log` y `audit_logs`: solo admin lee.

### Paso 4 — `004_storage.sql` ✅ (aplicado y verificado 2026-11-03)

Estado: bucket `receipts` privado, 5 MB, 4 MIME; política INSERT (carpeta propia + inscripción propia en PENDING_PAYMENT con plazo vigente) y SELECT (propio o admin). Sin UPDATE/DELETE para nadie. 20 pruebas en PGlite.
El frontend debe subir con `upsert: false` y nombre de archivo único (ej. con timestamp), y después llamar a `submit_receipt`.

Especificación original:
- Bucket privado `receipts`, límite de 5 MB, MIME `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- Ruta: `{user_id}/{registration_id}/{archivo}`.
- Políticas: INSERT solo dentro de la carpeta propia. SELECT propio o admin. Sin UPDATE ni DELETE para jugadores.
- El admin ve los comprobantes con signed URLs generadas en el servidor.

### Paso 5 — Google OAuth ✅ (configurado 2026-11-03)

Estado: proyecto `MATCHDAY` en Google Cloud, pantalla de consentimiento External **en producción** (sin verificación de marca: la pantalla muestra el dominio de Supabase, es cosmético), sin scopes extra. Cliente OAuth Web con orígenes localhost:3000 y el dominio de Vercel. Provider Google activo en Supabase (verificado vía `/auth/v1/settings` y `/authorize`: redirige a Google con `scope=email profile` y el callback correcto). Site URL y Redirect URLs (`/**`) cargadas. Página `/privacidad` creada (Google la exige). El JSON con el client secret lo guarda Mikael fuera del repo.

Especificación original:
Proyecto en Google Cloud, pantalla de consentimiento, credenciales OAuth Web y callback `https://uwputddqhhgcwrcetlci.supabase.co/auth/v1/callback`. En Supabase: activar el provider Google, Site URL y Redirect URLs (localhost:3000 y el dominio de Vercel). Guiar paso a paso y verificar.

### Paso 6 — Conexión Next.js ↔ Supabase ✅ (en producción 2026-11-03)

Estado: login con Google funcionando en local y en producción (probado por Mikael). Perfil creado por el trigger. `proxy.ts` usa `getClaims()` (nunca `getSession()` en servidor); rutas públicas: `/login`, `/auth/*`, `/privacidad`. Logout por POST a `/auth/signout`. Variables cargadas en Vercel (Production/Preview/Development); `DATABASE_URL` solo local. `@supabase/ssr@0.12.7`, `@supabase/supabase-js@2.118.0`. pnpm no está instalado global: usar `npx pnpm@12.3.4`.

Especificación original:
- `@supabase/ssr`, `lib/supabase/client.ts`, `lib/supabase/server.ts`.
- `proxy.ts` para refrescar la sesión y proteger rutas.
- `app/auth/callback/route.ts`.
- Helper `requireAdmin()` del lado servidor.
- `.env.local` (y `.env.example` sin valores) con:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `ADMIN_EMAIL`
  - `NEXT_PUBLIC_SITE_URL`
  - Más adelante: `RESEND_API_KEY` y `RESEND_FROM`.
- Evitar la secret key salvo que sea imprescindible, y en ese caso solo en el servidor.

### Paso 7 — Separar `page.tsx` en rutas reales, conectadas a datos
Rutas: `/login`, `/` (próximo partido y listas públicas), `/partidos/[id]`, `/mis-inscripciones`, `/perfil`, `/admin`, `/admin/partidos` (+ `nuevo` y `[id]`), `/admin/inscripciones` (con filtros por estado), `/admin/pagos` (cola de PENDING_REVIEW), `/admin/jugadores`, `/admin/configuracion`.

Reutilizar los componentes visuales existentes. Agregar la nav mobile del admin. Ocultar el acceso al admin para no admins. Validar el comprobante en el cliente (tipo y tamaño) y en Storage. Usar Server Actions que llamen a las funciones RPC.

Dividido en sub-etapas:
- **7a ✅ (aprobada por Mikael 2026-11-04):** rutas `/`, `/perfil`, `/mis-inscripciones`, `/admin` con layout `app/(jugador)`. Sidebar con nombre y foto reales, link al backoffice solo para el admin, perfil editable (Server Action, verificado en la base). Inicio, Mis inscripciones y admin siguen con mocks en `components/mock/` con aviso "Vista de ejemplo".
- **7b ✅ (probada por Mikael 2026-11-04, verificada en la base y en `audit_logs`):** `app/admin/layout.tsx` + `AdminShell` (drawer mobile), `/admin/configuracion` (medios de pago, alta/edición/activar), `/admin/partidos` (lista con cupos), `/nuevo` y `/[id]` (edición y transiciones de estado con confirmación). Horarios siempre en hora argentina (`lib/dates.ts`, offset fijo -03:00). Server Actions devuelven `ActionState` con `fields` para no perder lo escrito (React 19 resetea el form). Errores de la base: se muestra el HINT (`dbErrorMessage`).
- **7c:** jugador — próximo partido, listas, anotarse, datos de transferencia, subir comprobante, mis inscripciones reales.
- **7d:** admin — cola de pagos, inscripciones con filtros y promoción de suplentes, jugadores, dashboard real.

### Pasos 8 a 10
- Resend: notificar al admin cuando llega un comprobante, y al jugador cuando se aprueba o rechaza el pago y cuando es promovido. Registrar en `notifications_log`.
- Pruebas funcionales, de permisos y de concurrencia (casos de la sección 9 del documento de contexto).
- Variables en Vercel, deploy y verificación en producción.

## Decisiones funcionales

- Acceso abierto (decidido 2026-11-03): **cualquiera con cuenta de Google** puede entrar (vienen amigos y familiares ocasionales). No hay lista de emails habilitados. Quitar del login el texto "Solo para jugadores invitados".
- Dominio de producción en Vercel: `https://matchday-alpha-seven.vercel.app`.
- Acceso al backoffice (2026-11-04): queda como está. El admin entra con su Google, y el servidor y la base verifican su email (proxy + `requireAdmin()` + `is_admin()`). El link "Ir al backoffice" solo se renderiza para el admin. Mikael evaluó un login aparte con usuario y clave; se desaconsejó (menos seguro que Google y obliga a manejar dos cuentas). **Revisar en las pruebas reales** las alternativas: quitar el link y entrar por `/admin`, o sumar MFA TOTP de Supabase para el admin.
