'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Constants, type Enums } from '@/lib/supabase/database.types'
import { dbErrorMessage, fail, type ActionState } from '@/lib/action-state'

const PROVIDERS = Constants.public.Enums.payment_provider as readonly string[]
const UUID = /^[0-9a-f-]{36}$/i

/** Crea (sin id) o edita (con id) un medio de pago. La validación definitiva la hace la función SQL. */
export async function savePaymentSetting(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()

  const id = String(formData.get('id') ?? '')
  const provider = String(formData.get('provider') ?? '')
  const alias = String(formData.get('alias') ?? '').trim()
  const account = String(formData.get('account_number') ?? '').replace(/\s/g, '')
  const holder = String(formData.get('holder_name') ?? '').trim().replace(/\s+/g, ' ')

  if (id && !UUID.test(id)) return fail('Medio de pago inválido.', formData)
  if (!PROVIDERS.includes(provider)) return fail('Elegí la billetera.', formData)
  if (alias.length < 3 || alias.length > 60) return fail('Revisá el alias.', formData)
  if (!/^\d{22}$/.test(account)) return fail('El CVU/CBU tiene que tener 22 dígitos.', formData)
  if (holder.length < 2 || holder.length > 100) return fail('Completá el titular.', formData)

  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_save_payment_setting', {
    p_id: id || null,
    p_provider: provider as Enums<'payment_provider'>,
    p_alias: alias,
    p_account_number: account,
    p_holder_name: holder,
  })
  if (error) return fail(dbErrorMessage(error), formData)

  revalidatePath('/admin', 'layout')
  return { status: 'ok', message: id ? 'Cambios guardados.' : 'Medio de pago agregado.' }
}

/** Activa (y desactiva el resto) o desactiva un medio de pago. */
export async function setPaymentSettingActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()

  const id = String(formData.get('id') ?? '')
  const active = formData.get('active') === 'true'
  if (!UUID.test(id)) return fail('Medio de pago inválido.', formData)

  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_set_payment_setting_active', { p_id: id, p_active: active })
  if (error) return fail(dbErrorMessage(error), formData)

  revalidatePath('/admin', 'layout')
  return { status: 'ok', message: active ? 'Medio de pago activado.' : 'Medio de pago desactivado.' }
}
