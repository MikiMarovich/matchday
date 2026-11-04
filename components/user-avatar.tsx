'use client'

import { useState } from 'react'
import { initials } from '@/lib/labels'

/**
 * Foto de Google si existe; si no hay o falla al cargar, iniciales.
 * `className` reutiliza los estilos existentes: profile-avatar, top-avatar, large-avatar.
 */
export function UserAvatar({
  name,
  src,
  className,
}: {
  name: string | null
  src: string | null
  className: string
}) {
  const [failed, setFailed] = useState(false)
  const showImage = src && !failed

  return (
    <div className={`${className} avatar-photo`} aria-hidden="true">
      {showImage ? (
        // Las fotos de Google exigen no enviar referrer; next/image no aporta acá (images.unoptimized).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </div>
  )
}
