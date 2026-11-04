import { AlertTriangle, CalendarDays, Clock3, CreditCard, Info, MapPin, ShieldCheck, Users } from 'lucide-react'
import { UserAvatar } from '@/components/user-avatar'
import { TZ, formatDay, formatPrice, formatTime } from '@/lib/dates'
import { MATCH_STATUS_LABELS, PROVIDER_LABELS, formatAccount, positionLabel } from '@/lib/labels'
import { effectiveStatus, type Match, type MyRegistration, type RosterEntry } from '@/lib/player-data'
import { CancelRegistration, CopyButton, Countdown, ReceiptUpload, RegisterButton } from './registration-actions'

const dayFmt = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, day: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, month: 'short' })

/* ---------- Listas públicas ---------- */

function RosterList({ eyebrow, title, entries, empty, numbered = false }: {
  eyebrow: string
  title: string
  entries: RosterEntry[]
  empty: string
  numbered?: boolean
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <span className="count-pill">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <div className="empty-state empty-state-small">
          <Users />
          <p>{empty}</p>
        </div>
      ) : (
        <div className="player-list">
          {entries.map((p, i) => (
            <div className={`player-row ${p.is_me ? 'player-row-me' : ''}`} key={`${p.grupo}-${p.orden ?? i}`}>
              {numbered && <span className="roster-number">{p.orden ?? i + 1}</span>}
              <UserAvatar name={p.full_name} src={p.avatar_url} className="avatar avatar-small avatar-lime" />
              <div className="player-info">
                <strong>
                  {p.full_name ?? 'Jugador'}
                  {p.is_me && <em className="me-tag">vos</em>}
                </strong>
                <span>{positionLabel(p.position)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ---------- Panel "Tu inscripción" ---------- */

function MyRegistrationPanel({ reg, userId, waitlistPosition, freeSlots, nowMs }: {
  reg: MyRegistration
  userId: string
  waitlistPosition: number | null
  freeSlots: number
  nowMs: number
}) {
  const status = effectiveStatus(reg, nowMs)

  if (status === 'PENDING_PAYMENT') {
    return (
      <section className="panel transfer-card my-registration">
        <div className="panel-heading">
          <div>
            <span className="eyebrow lime-text">TU LUGAR ESTÁ RESERVADO</span>
            <h2>Transferí y subí el comprobante</h2>
          </div>
          <div className="deadline-box">
            <span>Tiempo restante</span>
            <Countdown deadline={reg.payment_deadline!} />
          </div>
        </div>
        <p className="panel-text">
          Tenés hasta las <b>{formatTime(reg.payment_deadline!)} hs</b> para enviar el comprobante. Si no llega a tiempo, el lugar se
          libera para otro jugador.
        </p>
        <div className="registration-grid">
          <div className="bank-details">
            <span>DATOS DE TRANSFERENCIA · {PROVIDER_LABELS[reg.payment_provider_snapshot!].toUpperCase()}</span>
            <p>
              <b>Monto</b>
              <strong>{formatPrice(reg.price_snapshot)}</strong>
            </p>
            <p>
              <b>Alias</b>
              <strong className="copyable">
                {reg.payment_alias_snapshot}
                <CopyButton value={reg.payment_alias_snapshot!} label="alias" />
              </strong>
            </p>
            <p>
              <b>CVU</b>
              <strong className="copyable">
                {formatAccount(reg.payment_account_snapshot!)}
                <CopyButton value={reg.payment_account_snapshot!} label="CVU" />
              </strong>
            </p>
            <p>
              <b>Titular</b>
              <strong>{reg.payment_holder_snapshot}</strong>
            </p>
            <div className="no-cash">
              <CreditCard />
              <div>
                <strong>NO SE ACEPTA EFECTIVO</strong>
                <p>Transferí el monto exacto desde tu billetera o banco.</p>
              </div>
            </div>
          </div>
          <ReceiptUpload userId={userId} registrationId={reg.id} />
        </div>
        <div className="my-registration-footer">
          <CancelRegistration registrationId={reg.id} warning="Si cancelás, tu lugar pasa al siguiente. Si ya transferiste, avisale al administrador." />
        </div>
      </section>
    )
  }

  if (status === 'PENDING_REVIEW') {
    return (
      <section className="pending-banner my-registration">
        <div className="pending-icon">
          <Clock3 />
        </div>
        <div>
          <strong>Comprobante enviado: tu lugar está guardado</strong>
          <p>El administrador lo va a revisar y te confirma. No hace falta que hagas nada más.</p>
        </div>
        <div className="banner-side">
          <CancelRegistration registrationId={reg.id} warning="Ya enviaste el comprobante: el reintegro lo coordinás con el administrador." />
        </div>
      </section>
    )
  }

  if (status === 'CONFIRMED') {
    return (
      <section className="pending-banner pending-banner-ok my-registration">
        <div className="pending-icon">
          <ShieldCheck />
        </div>
        <div>
          <strong>¡Estás confirmado!</strong>
          <p>Tu pago fue aprobado. Nos vemos en la cancha.</p>
        </div>
        <div className="banner-side">
          <CancelRegistration registrationId={reg.id} warning="Tu pago ya fue aprobado: el reintegro lo coordinás con el administrador." />
        </div>
      </section>
    )
  }

  if (status === 'WAITLIST') {
    return (
      <section className="pending-banner my-registration">
        <div className="pending-icon">
          <Users />
        </div>
        <div>
          <strong>Sos suplente{waitlistPosition ? ` N.° ${waitlistPosition}` : ''}</strong>
          <p>
            {freeSlots > 0
              ? `Hay ${freeSlots} ${freeSlots === 1 ? 'lugar libre' : 'lugares libres'}: si decidís jugar, cancelá la suplencia y anotate con lugar, o pedíselo al organizador. Por ahora no transfieras.`
              : 'Si se libera un lugar, el organizador te lo asigna y vas a ver acá los datos para pagar. Por ahora no transfieras.'}
          </p>
        </div>
        <div className="banner-side">
          <CancelRegistration registrationId={reg.id} />
        </div>
      </section>
    )
  }

  return null
}

/** Aviso sobre una inscripción anterior que ya no está activa (vencida, rechazada o cancelada). */
function PreviousOutcome({ reg, nowMs }: { reg: MyRegistration; nowMs: number }) {
  const status = effectiveStatus(reg, nowMs)
  let text: string | null = null
  if (status === 'EXPIRED') text = 'Se venció el plazo para pagar y tu lugar se liberó. Si querés jugar, anotate de nuevo.'
  if (status === 'REJECTED') text = `Tu pago fue rechazado${reg.rejection_reason ? `: «${reg.rejection_reason}»` : ''}. Podés anotarte de nuevo.`
  if (status === 'CANCELLED') {
    text = reg.cancellation_reason === 'Plazo vencido'
      ? 'Se venció el plazo para pagar y tu lugar se liberó. Si querés jugar, anotate de nuevo.'
      : `Tu inscripción fue cancelada${reg.cancellation_reason ? ` (${reg.cancellation_reason})` : ''}.`
  }
  if (!text) return null
  return (
    <div className="demo-notice outcome-notice" role="note">
      {status === 'REJECTED' ? <AlertTriangle /> : <Info />}
      <span>{text}</span>
    </div>
  )
}

/* ---------- Vista completa ---------- */

export function MatchView({ match, roster, myReg, userId, eyebrow, nowMs }: {
  match: Match
  roster: RosterEntry[]
  myReg: MyRegistration | null
  userId: string
  eyebrow: string
  nowMs: number
}) {
  const confirmed = roster.filter((r) => r.grupo === 'CONFIRMED')
  const pending = roster.filter((r) => r.grupo === 'PENDING')
  const waitlist = roster.filter((r) => r.grupo === 'WAITLIST')
  const occupied = confirmed.length + pending.length
  const free = Math.max(match.max_players - occupied, 0)
  const pct = Math.min(100, Math.round((occupied / match.max_players) * 100))

  const myStatus = myReg ? effectiveStatus(myReg, nowMs) : null
  const isActive = myStatus === 'PENDING_PAYMENT' || myStatus === 'PENDING_REVIEW' || myStatus === 'CONFIRMED' || myStatus === 'WAITLIST'
  const started = new Date(match.starts_at).getTime() <= nowMs
  const canRegister = match.status === 'OPEN' && !started && !isActive
  const myWaitlistPos = waitlist.find((r) => r.is_me)?.orden ?? null

  return (
    <>
      <section className="match-card">
        <div className="match-glow" />
        <div className="match-topline">
          <span className="eyebrow lime-text">{eyebrow}</span>
          <span className={`match-tag ${match.status === 'OPEN' ? '' : 'match-tag-muted'}`}>
            {match.status === 'OPEN' && <span className="live-dot" />} {MATCH_STATUS_LABELS[match.status]}
          </span>
        </div>
        <div className="match-title-row">
          <div>
            <h1>{match.title}</h1>
            <p className="match-subtitle">Cupo de {match.max_players} jugadores</p>
          </div>
          <div className="date-block">
            <strong>{dayFmt.format(new Date(match.starts_at))}</strong>
            <span>{monthFmt.format(new Date(match.starts_at)).replace('.', '').toUpperCase()}</span>
          </div>
        </div>
        <div className="match-details">
          <div>
            <CalendarDays />
            <span>
              <b className="capitalize-first">{formatDay(match.starts_at)}</b>
              <small>
                {formatTime(match.starts_at)}
                {match.ends_at ? ` — ${formatTime(match.ends_at)}` : ''} hs
              </small>
            </span>
          </div>
          <div>
            <MapPin />
            <span>
              <b>{match.location}</b>
              <small>Lugar del partido</small>
            </span>
          </div>
        </div>
        <div className="match-footer">
          <div>
            <span className="price-label">VALOR POR JUGADOR</span>
            <strong className="price">{formatPrice(match.price)}</strong>
          </div>
          {canRegister && <RegisterButton matchId={match.id} full={free === 0} />}
        </div>
        <div className="capacity">
          <div className="capacity-label">
            <span>
              <strong>{occupied}</strong> de {match.max_players} lugares ocupados
            </span>
            <span>
              {free > 0 ? (
                <>
                  <strong className="lime-text">{free}</strong> {free === 1 ? 'lugar disponible' : 'lugares disponibles'}
                </>
              ) : (
                <strong>Cupo completo</strong>
              )}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {match.notes && <p className="match-notes">{match.notes}</p>}
      </section>

      {myReg && !isActive && <PreviousOutcome reg={myReg} nowMs={nowMs} />}
      {myReg && isActive && <MyRegistrationPanel reg={myReg} userId={userId} waitlistPosition={myWaitlistPos} freeSlots={match.status === 'OPEN' ? free : 0} nowMs={nowMs} />}
      {!isActive && match.status === 'CLOSED' && (
        <div className="demo-notice outcome-notice" role="note">
          <Info />
          <span>La inscripción a este partido está cerrada.</span>
        </div>
      )}

      <div className="roster-grid">
        <RosterList eyebrow="PAGO APROBADO" title="Confirmados" entries={confirmed} empty="Todavía no hay confirmados." />
        <RosterList
          eyebrow="LUGAR RESERVADO"
          title="Pendientes de pago o revisión"
          entries={pending}
          empty="No hay pagos pendientes."
        />
        <RosterList eyebrow="EN ORDEN DE LLEGADA" title="Suplentes" entries={waitlist} empty="No hay suplentes." numbered />
      </div>
    </>
  )
}
