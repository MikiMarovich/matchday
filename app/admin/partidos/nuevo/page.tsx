import type { Metadata } from 'next'
import Link from 'next/link'
import { EMPTY_MATCH, MatchForm } from '../match-form'

export const metadata: Metadata = { title: 'Nuevo partido — MATCHDAY' }

export default function NuevoPartidoPage() {
  return (
    <div className="admin-stack">
      <Link href="/admin/partidos" className="back-link">
        ← Volver a partidos
      </Link>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="eyebrow">NUEVO</span>
            <h2>Crear partido</h2>
          </div>
        </div>
        <MatchForm values={EMPTY_MATCH} />
        <p className="field-hint panel-footnote">
          Se crea como borrador. Revisalo y después abrí la inscripción para que los jugadores lo vean.
        </p>
      </section>
    </div>
  )
}
