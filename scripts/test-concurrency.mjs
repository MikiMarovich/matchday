// =============================================================================
// MATCHDAY — Prueba de concurrencia de register_for_match
//
// Qué hace:
//   1. Crea usuarios de prueba (@matchday.test) y partidos de prueba "[TEST]".
//   2. Lanza N inscripciones EN SIMULTÁNEO (una conexión por jugador) contra un
//      partido de cupo bajo, y verifica que nunca se exceda max_players.
//   3. Lanza 5 inscripciones simultáneas del MISMO jugador: solo una debe entrar.
//   4. Borra todo lo que creó (también si algo falla).
//
// Cómo correrlo (desde la carpeta del proyecto):
//   node --env-file=.env.local scripts/test-concurrency.mjs
//
// Requiere en .env.local:  DATABASE_URL=<cadena "Session pooler" de Supabase>
// (Supabase → botón "Connect" → Session pooler. Es solo para pruebas locales:
//  nunca la pongas en Vercel ni en una variable NEXT_PUBLIC_.)
// =============================================================================

import pg from 'pg'
import { randomUUID } from 'node:crypto'

const PLAYERS = 12 // el Session pooler gratuito admite ~15 conexiones
const ROUNDS = [5, 2] // cupos de los partidos de prueba
const EMAIL_DOMAIN = '@matchday.test'

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en .env.local')
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, ''),
  ssl: { rejectUnauthorized: false },
  max: PLAYERS,
})

const created = { users: [], matches: [], paymentSettingId: null }
let failures = 0
const check = (label, ok, extra) => {
  console.log(`${ok ? '✓' : '✗ FALLA'} ${label}${!ok && extra ? ' → ' + JSON.stringify(extra) : ''}`)
  if (!ok) failures++
}

// Ejecuta una función como un jugador autenticado (igual que la API de Supabase).
async function callAs(client, user, sql, params) {
  await client.query('begin')
  try {
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: user.id, email: user.email, role: 'authenticated' }),
    ])
    await client.query('set local role authenticated')
    const r = await client.query(sql, params)
    await client.query('commit')
    return { row: r.rows[0] }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    return { error: e.message }
  }
}

// Lanza todas las llamadas "a la vez": primero toma todas las conexiones, después dispara.
async function fireConcurrently(jobs) {
  const clients = await Promise.all(jobs.map(() => pool.connect()))
  try {
    return await Promise.all(jobs.map((job, i) => job(clients[i])))
  } finally {
    clients.forEach((c) => c.release())
  }
}

async function setup() {
  const db = await pool.connect()
  try {
    for (let i = 1; i <= PLAYERS; i++) {
      const user = { id: randomUUID(), email: `concurrency-test-${i}${EMAIL_DOMAIN}` }
      await db.query(
        `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
         values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, $3, '{}', now(), now())`,
        [user.id, user.email, { full_name: `Test ${i}` }],
      )
      created.users.push(user)
    }

    const active = await db.query(`select id from public.payment_settings where is_active`)
    if (active.rowCount === 0) {
      const ps = await db.query(
        `insert into public.payment_settings (provider, alias, account_number, holder_name, is_active)
         values ('MERCADO_PAGO', 'test.concurrencia', '0000000000000000000000', '[TEST]', true) returning id`,
      )
      created.paymentSettingId = ps.rows[0].id
    }

    for (const cupo of [...ROUNDS, 5]) {
      const m = await db.query(
        `insert into public.matches (title, location, starts_at, price, max_players, status)
         values ($1, '[TEST]', now() + interval '1 day', 1000, $2, 'OPEN') returning id`,
        [`[TEST] concurrencia cupo ${cupo}`, cupo],
      )
      created.matches.push({ id: m.rows[0].id, cupo })
    }
  } finally {
    db.release()
  }
}

async function cleanup() {
  const db = await pool.connect()
  try {
    const ids = created.matches.map((m) => m.id)
    if (ids.length) await db.query(`delete from public.matches where id = any($1)`, [ids])
    if (created.paymentSettingId)
      await db.query(`delete from public.payment_settings where id = $1`, [created.paymentSettingId])
    await db.query(`delete from auth.users where email like $1`, [`concurrency-test-%${EMAIL_DOMAIN}`])
    console.log('🧹 Datos de prueba borrados')
  } finally {
    db.release()
  }
}

async function main() {
  console.log(`Preparando ${PLAYERS} jugadores de prueba...`)
  await setup()

  // Prueba 1: N jugadores distintos a la vez contra partidos de cupo bajo.
  for (const match of created.matches.slice(0, ROUNDS.length)) {
    const results = await fireConcurrently(
      created.users.map((u) => (c) => callAs(c, u, `select status from public.register_for_match($1)`, [match.id])),
    )
    const errors = results.filter((r) => r.error)
    const pending = results.filter((r) => r.row?.status === 'PENDING_PAYMENT').length
    const waitlist = results.filter((r) => r.row?.status === 'WAITLIST').length

    const db = await pool.connect()
    const real = (
      await db.query(
        `select count(*) filter (where status = 'PENDING_PAYMENT')::int as pending,
                count(*) filter (where status = 'WAITLIST')::int as waitlist
         from public.registrations where match_id = $1`,
        [match.id],
      )
    ).rows[0]
    db.release()

    console.log(`\nPartido cupo ${match.cupo}, ${PLAYERS} inscripciones simultáneas:`)
    check('ninguna inscripción falló', errors.length === 0, errors.slice(0, 3))
    check(`exactamente ${match.cupo} con cupo (PENDING_PAYMENT)`, pending === match.cupo && real.pending === match.cupo, { pending, real })
    check(`el resto (${PLAYERS - match.cupo}) como suplentes`, waitlist === PLAYERS - match.cupo && real.waitlist === waitlist, { waitlist, real })
  }

  // Prueba 2: el mismo jugador intenta anotarse 5 veces a la vez.
  const dupMatch = created.matches[ROUNDS.length]
  const user = created.users[0]
  const dup = await fireConcurrently(
    Array.from({ length: 5 }, () => (c) => callAs(c, user, `select status from public.register_for_match($1)`, [dupMatch.id])),
  )
  const ok = dup.filter((r) => r.row).length
  const blocked = dup.filter((r) => /ALREADY_REGISTERED|registrations_one_active_per_user/.test(r.error ?? '')).length
  console.log('\nMismo jugador, 5 intentos simultáneos:')
  check('solo 1 inscripción entra y las otras 4 se bloquean', ok === 1 && blocked === 4, dup)
}

try {
  await main()
} catch (e) {
  failures++
  console.error('\nError inesperado:', e.message)
} finally {
  await cleanup().catch((e) => console.error('⚠ No se pudo limpiar:', e.message))
  await pool.end()
  console.log(failures ? `\n${failures} FALLA(S)` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
}
