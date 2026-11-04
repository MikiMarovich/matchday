'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Constants, type Enums } from '@/lib/supabase/database.types'

export type ProfileFormState = { status: 'idle' | 'ok' | 'error'; message?: string }

const POSITIONS = Constants.public.Enums.player_position as readonly string[]

export async function updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser()

  const fullName = String(formData.get('full_name') ?? '').trim().replace(/\s+/g, ' ')
  const rawPosition = String(formData.get('position') ?? '')

  if (fullName.length < 2 || fullName.length > 100) {
    return { status: 'error', message: 'El nombre tiene que tener entre 2 y 100 caracteres.' }
  }
  if (rawPosition !== '' && !POSITIONS.includes(rawPosition)) {
    return { status: 'error', message: 'Elegí una posición válida.' }
  }
  const position = rawPosition === '' ? null : (rawPosition as Enums<'player_position'>)

  // RLS + permisos por columna: solo puede tocar full_name y position de SU perfil.
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, position })
    .eq('id', user.id)
    .select('id')

  if (error || !data?.length) {
    return { status: 'error', message: 'No pudimos guardar los cambios. Probá de nuevo.' }
  }

  revalidatePath('/', 'layout') // actualiza también el nombre del menú lateral
  return { status: 'ok', message: 'Cambios guardados.' }
}
