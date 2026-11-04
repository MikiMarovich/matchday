'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export function GoogleLoginButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    setLoading(true)
    setError(null)
    const callback = new URL('/auth/callback', window.location.origin)
    if (next) callback.searchParams.set('next', next)

    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback.toString() },
    })
    // Si todo sale bien, el navegador ya se fue a Google y esto no se ejecuta.
    if (error) {
      setError('No pudimos conectar con Google. Probá de nuevo.')
      setLoading(false)
    }
  }

  return (
    <>
      <Button className="google-button" onClick={handleLogin} disabled={loading}>
        <span className="google-g">G</span>
        {loading ? 'Conectando…' : 'Continuar con Google'}
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </>
  )
}
