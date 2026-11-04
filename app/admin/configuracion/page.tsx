import type { Metadata } from 'next'
import { AlertTriangle, Plus, WalletCards } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PROVIDER_LABELS } from '@/lib/labels'
import { PaymentSettingForm, ToggleActiveForm } from './payment-forms'

export const metadata: Metadata = { title: 'Configuración — MATCHDAY' }

export default async function ConfiguracionPage() {
  // RLS: payment_settings solo lo lee el admin (003_rls.sql).
  const supabase = await createClient()
  const { data: settings, error } = await supabase
    .from('payment_settings')
    .select('id, provider, alias, account_number, holder_name, is_active')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw new Error('No se pudieron cargar los medios de pago.')
  const hasActive = settings.some((s) => s.is_active)

  return (
    <div className="admin-stack">
      <div className="admin-intro">
        <span className="eyebrow">MEDIOS DE PAGO</span>
        <h2>Datos para la transferencia</h2>
        <p>
          Es la cuenta que ve el jugador cuando reserva su lugar. Solo puede haber <b>un medio activo</b>: al activar uno, el
          resto se desactiva. Cada inscripción guarda una copia de los datos del momento, así que cambiarlos no afecta a
          quienes ya reservaron.
        </p>
      </div>

      {!hasActive && (
        <div className="admin-alert" role="alert">
          <AlertTriangle />
          <span>
            <b>No hay un medio de pago activo.</b> Mientras no haya uno, nadie se puede anotar a los partidos.
          </span>
        </div>
      )}

      {settings.map((s) => (
        <section className="admin-panel" key={s.id}>
          <div className="admin-panel-heading">
            <div>
              <span className="eyebrow">{PROVIDER_LABELS[s.provider].toUpperCase()}</span>
              <h2>{s.alias}</h2>
            </div>
            <div className="heading-actions">
              {s.is_active ? (
                <span className="status-badge status-success">
                  <span className="status-dot" />
                  Activo
                </span>
              ) : (
                <span className="status-badge status-neutral">
                  <span className="status-dot" />
                  Inactivo
                </span>
              )}
              <ToggleActiveForm id={s.id} active={s.is_active} />
            </div>
          </div>
          <PaymentSettingForm setting={s} />
        </section>
      ))}

      {settings.length === 0 ? (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="eyebrow">NUEVO</span>
              <h2>Cargá tu primer medio de pago</h2>
            </div>
            <WalletCards className="heading-icon" />
          </div>
          <PaymentSettingForm />
          <p className="field-hint panel-footnote">Después de guardarlo, tocá «Usar este medio» para activarlo.</p>
        </section>
      ) : (
        <details className="admin-panel admin-details">
          <summary>
            <Plus />
            Agregar otro medio de pago
          </summary>
          <div className="admin-details-body">
            <PaymentSettingForm />
          </div>
        </details>
      )}
    </div>
  )
}
