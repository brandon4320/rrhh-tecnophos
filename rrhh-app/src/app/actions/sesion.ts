'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Cerrar sesión desde el server: así la barra lateral de RRHH no carga el
 * cliente de Supabase en el navegador solo para esto (~58 KB gz menos en las
 * pantallas que no mutan nada desde el cliente).
 */
export async function cerrarSesion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
