import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de privacidad — MATCHDAY',
  description: 'Qué datos usa MATCHDAY y para qué.',
}

const CONTACT_EMAIL = 'dmmarovich4@gmail.com'
const UPDATED_AT = '3 de noviembre de 2026'

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-foreground">
      <a href="/" className="text-sm text-primary hover:underline">
        ← Volver a MATCHDAY
      </a>

      <h1 className="mt-6 text-3xl font-bold">Política de privacidad</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: {UPDATED_AT}</p>

      <div className="mt-8 space-y-8 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold">Qué es MATCHDAY</h2>
          <p className="mt-2 text-muted-foreground">
            MATCHDAY es una aplicación sin fines comerciales para organizar partidos de fútbol entre amigos:
            permite anotarse a un partido, informar el pago de la cancha y ver quién juega.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Qué datos usamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>De tu cuenta de Google: nombre, email y foto de perfil. No accedemos a tus contactos, correos ni archivos.</li>
            <li>La posición en la que jugás, si la cargás en tu perfil.</li>
            <li>Tus inscripciones a partidos y su estado (pendiente de pago, confirmada, suplente, cancelada).</li>
            <li>Los comprobantes de transferencia que subas para informar un pago.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Para qué los usamos</h2>
          <p className="mt-2 text-muted-foreground">
            Solo para organizar los partidos: identificarte al iniciar sesión, reservar tu lugar, que el
            organizador verifique tu pago y avisarte por email sobre el estado de tu inscripción.
            No vendemos ni compartimos tus datos con terceros con fines comerciales y no mostramos publicidad.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Quién los ve</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Los demás jugadores ven tu nombre, tu foto y tu posición en la lista de cada partido. Nunca tu email ni tus comprobantes.</li>
            <li>El organizador del grupo ve tu email, tus inscripciones y los comprobantes que subas.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Dónde se guardan</h2>
          <p className="mt-2 text-muted-foreground">
            Los datos se guardan en Supabase (base de datos y almacenamiento) y la aplicación se aloja en Vercel.
            Los comprobantes están en un almacenamiento privado, sin acceso público.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Tus derechos</h2>
          <p className="mt-2 text-muted-foreground">
            Podés pedir acceder a tus datos, corregirlos o eliminarlos en cualquier momento escribiendo a{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>
            , conforme a la Ley 25.326 de Protección de Datos Personales de Argentina.
          </p>
        </section>
      </div>
    </main>
  )
}
