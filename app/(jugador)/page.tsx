import { HomeMock } from '@/components/mock/player-mock'
import { getMyProfile } from '@/lib/auth'
import { firstName } from '@/lib/labels'

// TODO(7c): reemplazar por el próximo partido real y las listas de get_match_roster.
export default async function InicioPage() {
  const profile = await getMyProfile()
  const today = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date())

  return <HomeMock firstName={firstName(profile.full_name)} today={today} />
}
