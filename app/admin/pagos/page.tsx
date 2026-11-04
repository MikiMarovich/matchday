import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink, FileText, WalletCards } from 'lucide-react'
import { UserAvatar } from '@/components/user-avatar'
import { ReviewButtons } from '@/components/admin/registration-controls'
import { getReceiptUrls, getRegistrations } from '@/lib/admin-data'
import { formatMatchWhen, formatPrice, formatTime, formatDay } from '@/lib/dates'
import { PROVIDER_LABELS } from '@/lib/labels'

export const metadata: Metadata = { title: 'Pagos — MATCHDAY' }

export default async function PagosPage() {
  const queue = await getRegistrations({ statuses: ['PENDING_REVIEW'], orderBy: 'receipt_submitted_at' })
  const urls = await getReceiptUrls(queue.map((r) => r.receipt_path).filter((p): p is string => Boolean(p)))

  return (
    <div className="admin-stack">
      <div className="admin-intro">
        <span className="eyebrow">COLA DE REVISIÓN</span>
        <h2>Comprobantes por revisar</h2>
        <p>
          Revisá cada comprobante contra los movimientos de tu cuenta antes de aprobar. Mientras están acá, el lugar del
          jugador está guardado. <b>Rechazar libera el lugar</b> y el jugador ve el motivo. Los links a los archivos duran 10
          minutos: si vencen, recargá la página.
        </p>
      </div>

      {queue.length === 0 ? (
        <section className="admin-panel">
          <div className="empty-state">
            <WalletCards />
            <p>No hay comprobantes pendientes. ¡Todo al día!</p>
          </div>
        </section>
      ) : (
        queue.map((r) => {
          const url = r.receipt_path ? urls.get(r.receipt_path) : undefined
          const isPdf = r.receipt_path?.endsWith('.pdf')
          const name = r.player?.full_name ?? r.player?.email ?? 'Jugador'
          return (
            <section className="admin-panel review-card" key={r.id}>
              <div className="review-receipt">
                {url ? (
                  isPdf ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="receipt-pdf">
                      <FileText />
                      Abrir PDF
                    </a>
                  ) : (
                    <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir en tamaño completo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Comprobante de ${name}`} />
                    </a>
                  )
                ) : (
                  <span className="receipt-missing">No se pudo generar el link del archivo.</span>
                )}
              </div>
              <div className="review-body">
                <div className="table-player">
                  <UserAvatar name={r.player?.full_name ?? null} src={r.player?.avatar_url ?? null} className="avatar avatar-small avatar-lime" />
                  <span>
                    <b>{name}</b>
                    <small>{r.player?.email}</small>
                  </span>
                </div>
                <dl className="review-data">
                  <div>
                    <dt>Partido</dt>
                    <dd>
                      {r.match ? (
                        <Link href={`/admin/inscripciones?partido=${r.match.id}`}>
                          {r.match.title} · <span className="capitalize-first">{formatMatchWhen(r.match.starts_at, r.match.ends_at)}</span>
                        </Link>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Monto a verificar</dt>
                    <dd className="review-amount">{formatPrice(r.price_snapshot)}</dd>
                  </div>
                  <div>
                    <dt>Cuenta destino</dt>
                    <dd>
                      {r.payment_alias_snapshot}
                      {r.payment_provider_snapshot ? ` (${PROVIDER_LABELS[r.payment_provider_snapshot]})` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Enviado</dt>
                    <dd className="capitalize-first">
                      {r.receipt_submitted_at ? `${formatDay(r.receipt_submitted_at)} · ${formatTime(r.receipt_submitted_at)} hs` : '—'}
                    </dd>
                  </div>
                </dl>
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="receipt-open">
                    Ver comprobante en otra pestaña <ExternalLink />
                  </a>
                )}
                <ReviewButtons registrationId={r.id} playerName={name} />
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
