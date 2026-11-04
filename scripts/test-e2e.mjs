// =============================================================================
// MATCHDAY — Pruebas de punta a punta contra la base REAL (Paso 9)
//
// Qué prueba:
//   A. La API pública (lo que ve cualquiera con la clave publishable, sin sesión).
//   B. Permisos entre jugadores: nadie ve ni toca datos de otro, ni ejecuta acciones
//      de admin, aunque arme el pedido a mano salteándose las pantallas.
//   C. Flujo del admin: aprobar, liberar vencidas, promover suplente, cancelar partido.
//
// Cómo lo hace:
//   * Crea 4 jugadores de prueba (@matchday.test) y 2 partidos "[TEST]".
//   * Cada llamada corre como lo haría la API de Supabase: rol `authenticated` con el
//     JWT del jugador (request.jwt.claims). Las acciones de admin usan la identidad del
//     admin real (email de public.admins), así que pasan por is_admin() de verdad.
//   * Al terminar BORRA todo lo que creó, incluidos los registros de audit_logs de
//     esas pruebas (también si algo falla). No toca los partidos ni las inscripciones reales.
//
// Cómo correrlo (desde la carpeta del proyecto):
//   node --env-file=.env.local scripts/test-e2e.mjs
// Requiere en .env.local: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// =============================================================================

import pg from 'pg'
import { randomUUID } from 'node:crypto'

const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL: API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: API_KEY } = process.env
if (!DATABASE_URL || !API_URL || !API_KEY) {
  console.error('Faltan DATABASE_URL / NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local')
  process.exit(1)
}

const EMAIL_DOMAIN = '@matchday.test'
const pool = new pg.Pool({
  connectionString: DATABASE_URL.replace(/[?&]sslmode=[^&]*/, ''),
  ssl: { rejectUnauthorized: false },
  max: 3,
})
const db = await pool.connect()

const created = { matches: [], regs: new Set() }
const users = {}
let admin = null
let failures = 0

const check = (label, ok, extra) => {
  console.log(`${ok ? '✓' : '✗ FALLA'} ${label}${!ok && extra !== undefined ? ' → ' + JSON.stringify(extra) : ''}`)
  if (!ok) failures++
}
const section = (t) => console.log(`\n── ${t}`)

/** Corre SQL como un usuario autenticado, igual que la API de Supabase. */
async function as(user, sql, params = []) {
  await db.query('begin')
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: user.id, email: user.email, role: 'authenticated' }),
    ])
    await db.query('set local role authenticated')
    const r = await db.query(sql, params)
    await db.query('commit')
    return { rows: r.rows, count: r.rowCount }
  } catch (e) {
    await db.query('rollback').catch(() => {})
    return { error: e.message }
  }
}
const errIs = (r, code) => new RegExp(code).test(r.error ?? '')
const track = (r) => {
  if (r.rows?.[0]?.id) created.regs.add(r.rows[0].id)
  return r
}
const register = async (who, matchId) => track(await as(users[who], `select * from public.register_for_match($1)`, [matchId]))

// --------------------------------------------------------------------------- setup
async function setup() {
  const a = await db.query(
    `select p.id, p.email from public.admins a join public.profiles p on lower(p.email) = lower(a.email) limit 1`,
  )
  if (a.rowCount === 0) throw new Error('No encontré el perfil del admin (¿entró alguna vez con Google?).')
  admin = a.rows[0]

  const active = await db.query(`select 1 from public.payment_settings where is_active`)
  if (active.rowCount === 0) throw new Error('No hay un medio de pago activo: activá uno antes de correr la prueba.')

  for (const name of ['p1', 'p2', 'p3', 'p4']) {
    const u = { id: randomUUID(), email: `e2e-${name}${EMAIL_DOMAIN}` }
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
       values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, $3, '{}', now(), now())`,
      [u.id, u.email, { full_name: `Prueba ${name.toUpperCase()}` }],
    )
    users[name] = u
  }

  const open = await db.query(
    `insert into public.matches (title, location, starts_at, price, max_players, status, payment_window_minutes)
     values ('[TEST] e2e cupo 2', '[TEST]', now() + interval '2 days', 1000, 2, 'OPEN', 30) returning id`,
  )
  const draft = await db.query(
    `insert into public.matches (title, location, starts_at, price, max_players, status)
     values ('[TEST] e2e borrador', '[TEST]', now() + interval '3 days', 1000, 10, 'DRAFT') returning id`,
  )
  created.matches.push(open.rows[0].id, draft.rows[0].id)
  return { M: open.rows[0].id, D: draft.rows[0].id }
}

async function cleanup() {
  const ids = [...created.matches, ...created.regs]
  if (ids.length) await db.query(`delete from public.audit_logs where entity_id = any($1::uuid[])`, [ids])
  if (created.matches.length) await db.query(`delete from public.matches where id = any($1::uuid[])`, [created.matches])
  await db.query(`delete from auth.users where email like $1`, [`e2e-%${EMAIL_DOMAIN}`])
  const left = await db.query(
    `select (select count(*) from public.matches where title like '[TEST]%')::int m,
            (select count(*) from auth.users where email like $1)::int u`,
    [`%${EMAIL_DOMAIN}`],
  )
  console.log(`\n🧹 Datos de prueba borrados (quedan: ${left.rows[0].m} partidos [TEST], ${left.rows[0].u} usuarios de prueba)`)
}

// --------------------------------------------------------------------------- A. API pública
async function publicApi() {
  section('A. API pública sin sesión (clave publishable)')
  const headers = { apikey: API_KEY, 'Content-Type': 'application/json' }
  for (const table of ['profiles', 'matches', 'registrations', 'payment_settings', 'audit_logs', 'notifications_log', 'admins']) {
    const res = await fetch(`${API_URL}/rest/v1/${table}?select=*&limit=1`, { headers })
    const body = await res.json().catch(() => ({}))
    check(`anon no puede leer ${table}`, !res.ok && (body.code === '42501' || res.status === 401), { status: res.status, code: body.code })
  }
  for (const fn of ['register_for_match', 'get_match_roster', 'approve_payment', 'is_admin']) {
    const res = await fetch(`${API_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: '{}' })
    check(`anon no puede ejecutar ${fn}()`, !res.ok, { status: res.status })
  }
  const bucket = await fetch(`${API_URL}/storage/v1/object/list/receipts`, {
    method: 'POST',
    headers: { ...headers, Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ prefix: '' }),
  })
  const files = await bucket.json().catch(() => null)
  check('anon no puede listar comprobantes', !bucket.ok || (Array.isArray(files) && files.length === 0), { status: bucket.status })
}

// --------------------------------------------------------------------------- B. Permisos entre jugadores
async function playerPermissions({ M, D }) {
  section('B. Inscripción y permisos entre jugadores (partido de cupo 2)')
  const r1 = await register('p1', M)
  const r2 = await register('p2', M)
  const r3 = await register('p3', M)
  const r4 = await register('p4', M)
  check('p1 y p2 reservan lugar (PENDING_PAYMENT)', r1.rows?.[0]?.status === 'PENDING_PAYMENT' && r2.rows?.[0]?.status === 'PENDING_PAYMENT', [r1.error, r2.error])
  check('p3 y p4 quedan suplentes (cupo lleno)', r3.rows?.[0]?.status === 'WAITLIST' && r4.rows?.[0]?.status === 'WAITLIST', [r3.error, r4.error])
  check('el suplente no recibe datos de pago', r3.rows?.[0]?.payment_alias_snapshot === null)
  check('p1 no puede anotarse dos veces', errIs(await register('p1', M), 'ALREADY_REGISTERED'))
  check('nadie se anota a un borrador', errIs(await register('p1', D), 'MATCH_NOT_OPEN'))
  const reg1 = r1.rows[0]

  const p2 = users.p2
  const regs = await as(p2, `select id, user_id, payment_alias_snapshot from public.registrations`)
  check('p2 solo ve SU inscripción', regs.rows?.length === 1 && regs.rows[0].user_id === p2.id, regs.rows?.length)
  check('p2 no ve la inscripción de p1 ni por id', (await as(p2, `select * from public.registrations where id = $1`, [reg1.id])).rows?.length === 0)
  const profs = await as(p2, `select id, email from public.profiles`)
  check('p2 solo ve SU perfil (no emails ajenos)', profs.rows?.length === 1 && profs.rows[0].id === p2.id, profs.rows?.length)
  check('p2 no ve medios de pago', (await as(p2, `select * from public.payment_settings`)).rows?.length === 0)
  check('p2 no ve audit_logs', (await as(p2, `select * from public.audit_logs`)).rows?.length === 0)
  check('p2 no ve notifications_log', (await as(p2, `select * from public.notifications_log`)).rows?.length === 0)
  check('p2 no ve la tabla admins', !!(await as(p2, `select * from public.admins`)).error)
  check('p2 no ve partidos en borrador', (await as(p2, `select * from public.matches where id = $1`, [D])).rows?.length === 0)
  check('p2 no ve comprobantes de nadie (Storage)', (await as(p2, `select name from storage.objects where bucket_id = 'receipts'`)).rows?.length === 0)

  const roster = await as(p2, `select * from public.get_match_roster($1)`, [M])
  const cols = Object.keys(roster.rows?.[0] ?? {}).sort().join(',')
  check('la lista pública no expone email ni datos de pago', cols === 'avatar_url,full_name,grupo,is_me,orden,position', cols)
  const wait = roster.rows?.filter((r) => r.grupo === 'WAITLIST').map((r) => r.full_name).join(',')
  check('suplentes en orden de llegada (P3, P4)', wait === 'Prueba P3,Prueba P4', wait)
  check('la lista de un borrador no se puede pedir', errIs(await as(p2, `select * from public.get_match_roster($1)`, [D]), 'MATCH_NOT_FOUND'))

  section('B2. Un jugador intentando saltear las pantallas')
  check('p2 no puede cancelar la inscripción de p1', errIs(await as(p2, `select public.cancel_registration($1, null)`, [reg1.id]), 'REGISTRATION_NOT_FOUND'))
  check('p2 no puede enviar comprobante por p1', errIs(await as(p2, `select public.submit_receipt($1, $2)`, [reg1.id, `${p2.id}/${reg1.id}/x.pdf`]), 'REGISTRATION_NOT_FOUND'))
  check('p1 no puede usar una ruta fuera de su carpeta', errIs(await as(users.p1, `select public.submit_receipt($1, $2)`, [reg1.id, `${p2.id}/${reg1.id}/x.pdf`]), 'INVALID_RECEIPT_PATH'))
  check('p1 no puede declarar un archivo que no subió', errIs(await as(users.p1, `select public.submit_receipt($1, $2)`, [reg1.id, `${users.p1.id}/${reg1.id}/inventado.pdf`]), 'RECEIPT_NOT_FOUND'))
  check('p2 no puede registrar emails sobre p1', errIs(await as(p2, `select public.log_receipt_notification($1, 'SENT')`, [reg1.id]), 'REGISTRATION_NOT_FOUND'))
  check('p2 no puede aprobar pagos', errIs(await as(p2, `select public.approve_payment($1)`, [reg1.id]), 'FORBIDDEN'))
  check('p2 no puede promover suplentes', errIs(await as(p2, `select public.promote_from_waitlist($1, null)`, [M]), 'FORBIDDEN'))
  check('p2 no puede cerrar el partido', errIs(await as(p2, `select public.admin_set_match_status($1, 'CLOSED')`, [M]), 'FORBIDDEN'))
  check('p2 no puede crear partidos', errIs(await as(p2, `select public.admin_create_match('x','x', now() + interval '1 day', null, 1, 2)`), 'FORBIDDEN'))
  check('p2 no puede tocar medios de pago', errIs(await as(p2, `select public.admin_save_payment_setting(null, 'MERCADO_PAGO', 'hack', '0000000000000000000000', 'x')`), 'FORBIDDEN'))
  check('p2 no puede insertar inscripciones directo', !!(await as(p2, `insert into public.registrations (match_id, user_id, status, price_snapshot) values ($1, $2, 'CONFIRMED', 0)`, [M, p2.id])).error)
  check('p2 no puede confirmarse a sí mismo', !!(await as(p2, `update public.registrations set status = 'CONFIRMED' where user_id = $1`, [p2.id])).error)
  check('p2 no puede editar el perfil de p1 (0 filas)', (await as(p2, `update public.profiles set full_name = 'hack' where id = $1`, [users.p1.id])).count === 0)
  check('p2 no puede cambiar su email', !!(await as(p2, `update public.profiles set email = 'x@x.com' where id = $1`, [p2.id])).error)
  check('p2 sí puede editar su nombre y posición', (await as(p2, `update public.profiles set full_name = 'Prueba P2', position = 'DELANTERO' where id = $1`, [p2.id])).count === 1)
  check('p2 no puede cambiar el precio del partido', !!(await as(p2, `update public.matches set price = 1 where id = $1`, [M])).error)
  check('p2 no se puede autoproclamar admin', !!(await as(p2, `insert into public.admins values ($1)`, [p2.email])).error)

  return { reg1, reg2: r2.rows[0] }
}

// --------------------------------------------------------------------------- C. Flujo del admin
async function adminFlow({ M }, { reg1, reg2 }) {
  section('C. Flujo del admin (con la identidad real del admin)')
  check('el admin ve todas las inscripciones del partido', (await as(admin, `select id from public.registrations where match_id = $1`, [M])).rows?.length === 4)
  check('el admin ve el borrador', (await as(admin, `select id from public.matches where title = '[TEST] e2e borrador'`)).rows?.length === 1)

  // El comprobante real lo sube el navegador a Storage; acá simulamos que ya lo envió
  // (la subida y sus políticas se probaron aparte, 20 pruebas del Paso 4 + prueba manual).
  await db.query(
    `update public.registrations set status = 'PENDING_REVIEW', receipt_path = $2, receipt_submitted_at = now() where id = $1`,
    [reg1.id, `${users.p1.id}/${reg1.id}/simulado.pdf`],
  )
  const ap = await as(admin, `select * from public.approve_payment($1)`, [reg1.id])
  check('aprobar pago → CONFIRMED', ap.rows?.[0]?.status === 'CONFIRMED', ap.error)
  check('no se puede aprobar dos veces', errIs(await as(admin, `select public.approve_payment($1)`, [reg1.id]), 'INVALID_STATUS'))
  check('no se puede rechazar sin motivo', errIs(await as(admin, `select public.reject_payment($1, '  ')`, [reg2.id]), 'REASON_REQUIRED'))

  // p2 no pagó a tiempo: vencemos su plazo.
  await db.query(`update public.registrations set payment_deadline = now() - interval '1 minute' where id = $1`, [reg2.id])
  const ex = await as(admin, `select public.expire_pending_payments($1) as n`, [M])
  check('liberar vencidas → 1 liberada', ex.rows?.[0]?.n === 1, ex)
  const r2 = await db.query(`select status, cancellation_reason from public.registrations where id = $1`, [reg2.id])
  check('la vencida queda CANCELLED con motivo "Plazo vencido"', r2.rows[0].status === 'CANCELLED' && r2.rows[0].cancellation_reason === 'Plazo vencido', r2.rows[0])

  const deadline = new Date(Date.now() + 45 * 60_000).toISOString()
  const pr = track(await as(admin, `select * from public.promote_from_waitlist($1, $2)`, [M, deadline]))
  const promoted = pr.rows?.[0]
  check('promover → el suplente N.° 1 (P3) pasa a PENDING_PAYMENT', promoted?.status === 'PENDING_PAYMENT' && promoted?.user_id === users.p3.id, pr.error ?? promoted)
  check('con el plazo que eligió el admin (45 min)', Math.abs(new Date(promoted?.payment_deadline).getTime() - new Date(deadline).getTime()) < 2000)
  check('y con los datos de pago para transferir', !!promoted?.payment_alias_snapshot && !!promoted?.payment_account_snapshot)
  const p3view = await as(users.p3, `select status, payment_alias_snapshot from public.registrations`)
  check('P3 ve su lugar reservado y el alias', p3view.rows?.[0]?.status === 'PENDING_PAYMENT' && !!p3view.rows[0].payment_alias_snapshot)
  check('sin lugar libre no se puede promover otro', errIs(await as(admin, `select public.promote_from_waitlist($1, null)`, [M]), 'NO_SLOTS_AVAILABLE'))

  const again = await register('p2', M)
  check('P2 se vuelve a anotar → suplente detrás de P4', again.rows?.[0]?.status === 'WAITLIST', again.error)
  const roster = await as(users.p4, `select full_name, orden from public.get_match_roster($1) where grupo = 'WAITLIST'`, [M])
  check('orden de suplentes: P4 (1), P2 (2)', roster.rows?.map((r) => `${r.full_name}:${r.orden}`).join(',') === 'Prueba P4:1,Prueba P2:2', roster.rows)

  const cancel = await as(admin, `select public.admin_set_match_status($1, 'CANCELLED')`, [M])
  check('cancelar el partido', !cancel.error, cancel.error)
  const left = await db.query(
    `select count(*) filter (where status not in ('CANCELLED','REJECTED'))::int activas,
            count(*) filter (where cancellation_reason = 'Partido suspendido')::int suspendidas
     from public.registrations where match_id = $1`,
    [M],
  )
  check('todas las inscripciones activas quedan "Partido suspendido"', left.rows[0].activas === 0 && left.rows[0].suspendidas === 4, left.rows[0])
  check('un partido cancelado no se reabre', errIs(await as(admin, `select public.admin_set_match_status($1, 'OPEN')`, [M]), 'INVALID_TRANSITION'))

  const audit = await db.query(
    `select action from public.audit_logs where entity_id = any($1::uuid[]) order by created_at`,
    [[...created.matches, ...created.regs]],
  )
  const actions = new Set(audit.rows.map((r) => r.action))
  check(
    'cada acción del admin quedó en audit_logs',
    ['APPROVE_PAYMENT', 'EXPIRE_PENDING_PAYMENTS', 'PROMOTE_FROM_WAITLIST', 'SET_MATCH_STATUS'].every((a) => actions.has(a)),
    [...actions],
  )
}

// --------------------------------------------------------------------------- main
try {
  console.log('Preparando datos de prueba…')
  const ids = await setup()
  await publicApi()
  const regs = await playerPermissions(ids)
  await adminFlow(ids, regs)
} catch (e) {
  failures++
  console.error('\nError inesperado:', e.message)
} finally {
  await cleanup().catch((e) => console.error('⚠ No se pudo limpiar:', e.message))
  db.release()
  await pool.end()
  console.log(failures ? `\n${failures} FALLA(S)` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
}
