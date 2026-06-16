import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { internalEmailToUsername, normalizeUsername, usernameToInternalEmail } from '@/lib/auth-helpers'
import { requireRol } from '@/lib/auth/session'
import { SectionHeader } from '@/components/operaciones/SectionHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

const ROLES = [
  { v: 'admin_adc', l: 'Admin ADC' },
  { v: 'supervisor', l: 'Supervisor' },
  { v: 'operario', l: 'Operario' },
  { v: 'admin_unipar', l: 'Cliente UNIPAR (solo lectura)' },
]
const ROL_LABEL = (v: string) => ROLES.find((r) => r.v === v)?.l ?? v
const ROLES_OPS = ['admin_adc', 'supervisor', 'operario', 'admin_unipar']

async function guard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
  if (!['admin', 'admin_adc'].includes(perfil?.rol ?? '')) redirect('/operaciones')
  return user
}

export default async function AccesosPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>
}) {
  await requireRol(['admin', 'admin_adc'])
  const params = (await searchParams) ?? {}
  const supabase = await createClient()

  const { data: perfiles } = await supabase
    .from('perfiles')
    .select('id, nombre, rol')
    .in('rol', ROLES_OPS)

  let usuarios: { id: string; username: string; nombre: string; rol: string; lastSignInAt?: string | null }[] = []
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient()
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const map = new Map((perfiles ?? []).map((p) => [p.id, p]))
      usuarios = (data?.users ?? [])
        .filter((u) => map.has(u.id))
        .map((u) => {
          const p = map.get(u.id)!
          const meta = u.user_metadata ?? {}
          return {
            id: u.id,
            username: String(meta.username ?? internalEmailToUsername(u.email ?? '')),
            nombre: String(meta.nombre ?? p.nombre ?? '—'),
            rol: String(p.rol),
            lastSignInAt: u.last_sign_in_at,
          }
        })
        .sort((a, b) => a.username.localeCompare(b.username))
    } catch {
      usuarios = []
    }
  }

  async function crear(formData: FormData) {
    'use server'
    await guard()
    const username = normalizeUsername(String(formData.get('username') ?? ''))
    const nombre = String(formData.get('nombre') ?? '').trim()
    const password = String(formData.get('password') ?? '').trim()
    const rol = String(formData.get('rol') ?? '')
    if (!username || !nombre || password.length < 6 || !ROLES_OPS.includes(rol)) {
      redirect('/operaciones/accesos?error=campos')
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) redirect('/operaciones/accesos?error=service')

    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email: usernameToInternalEmail(username),
      password,
      email_confirm: true,
      user_metadata: { nombre, username },
    })
    if (error || !data.user) redirect('/operaciones/accesos?error=crear')
    const { error: pe } = await admin.from('perfiles').insert({ id: data.user.id, nombre, rol, empresa_acceso: null })
    if (pe) {
      await admin.auth.admin.deleteUser(data.user.id)
      redirect('/operaciones/accesos?error=perfil')
    }
    redirect('/operaciones/accesos?success=creado')
  }

  async function cambiarRol(formData: FormData) {
    'use server'
    await guard()
    const userId = String(formData.get('user_id') ?? '')
    const rol = String(formData.get('rol') ?? '')
    if (!userId || !ROLES_OPS.includes(rol)) redirect('/operaciones/accesos?error=campos')
    const admin = createAdminClient()
    await admin.from('perfiles').update({ rol }).eq('id', userId)
    redirect('/operaciones/accesos?success=rol')
  }

  async function resetPassword(formData: FormData) {
    'use server'
    await guard()
    const userId = String(formData.get('user_id') ?? '')
    const password = String(formData.get('password') ?? '').trim()
    if (!userId || password.length < 6) redirect('/operaciones/accesos?error=pass')
    const admin = createAdminClient()
    await admin.auth.admin.updateUserById(userId, { password })
    redirect('/operaciones/accesos?success=pass')
  }

  async function eliminar(formData: FormData) {
    'use server'
    await guard()
    const userId = String(formData.get('user_id') ?? '')
    if (!userId) redirect('/operaciones/accesos?error=campos')
    const admin = createAdminClient()
    await admin.from('perfiles').delete().eq('id', userId)
    await admin.auth.admin.deleteUser(userId)
    redirect('/operaciones/accesos?success=eliminado')
  }

  const msgError: Record<string, string> = {
    campos: 'Completá usuario, nombre, contraseña (mín. 6) y rol.',
    service: 'Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.',
    crear: 'No se pudo crear el usuario (¿usuario ya existe?).',
    perfil: 'No se pudo asignar el rol.',
    pass: 'La contraseña debe tener al menos 6 caracteres.',
  }
  const msgOk: Record<string, string> = {
    creado: 'Acceso creado.',
    rol: 'Rol actualizado.',
    pass: 'Contraseña actualizada.',
    eliminado: 'Acceso eliminado.',
  }

  return (
    <div className="space-y-5">
      <SectionHeader n="·" title="Accesos al servicio" subtitle="Usuarios que entran a Operaciones y su rol" />

      {params.error && (
        <div className="rounded-md border border-red-500/30 bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-400">
          {msgError[params.error] ?? 'Error.'}
        </div>
      )}
      {params.success && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-100 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
          {msgOk[params.success] ?? 'Listo.'}
        </div>
      )}

      {!process.env.SUPABASE_SERVICE_ROLE_KEY && (
        <div className="rounded-md border border-amber-500/30 bg-amber-100 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
          Falta <strong>SUPABASE_SERVICE_ROLE_KEY</strong> en el entorno para crear/gestionar accesos.
        </div>
      )}

      {/* Crear acceso */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <h2 className="mb-4 font-medium">Nuevo acceso</h2>
          <form action={crear} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre y apellido</Label>
              <Input id="nombre" name="nombre" required placeholder="Juan García" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="username">Usuario</Label>
              <Input id="username" name="username" required placeholder="juan.garcia" autoComplete="off" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña inicial</Label>
              <Input id="password" name="password" required minLength={6} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rol">Rol</Label>
              <select id="rol" name="rol" defaultValue="operario" className="h-9 w-full rounded-md border border-input px-3 text-sm">
                {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Crear acceso</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Listado */}
      {usuarios.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No hay accesos de Operaciones creados.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {usuarios.map((u) => (
            <Card key={u.id} className="py-0">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.nombre}</p>
                    <p className="text-sm text-muted-foreground">@{u.username}</p>
                  </div>
                  <Badge variant="secondary">{ROL_LABEL(u.rol)}</Badge>
                </div>

                <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
                  <form action={cambiarRol} className="flex items-center gap-2">
                    <input type="hidden" name="user_id" value={u.id} />
                    <select name="rol" defaultValue={u.rol} className="h-8 flex-1 rounded-md border border-input px-2 text-xs">
                      {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                    </select>
                    <Button type="submit" size="sm" variant="outline">Cambiar rol</Button>
                  </form>

                  <form action={resetPassword} className="flex items-center gap-2">
                    <input type="hidden" name="user_id" value={u.id} />
                    <Input name="password" minLength={6} required placeholder="Nueva contraseña" className="h-8 flex-1 text-sm" />
                    <Button type="submit" size="sm" variant="outline">Reset</Button>
                  </form>
                </div>

                <form action={eliminar} className="mt-2">
                  <input type="hidden" name="user_id" value={u.id} />
                  <Button type="submit" size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                    Eliminar acceso
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
