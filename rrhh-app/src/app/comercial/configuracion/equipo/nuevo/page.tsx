import { requireModulo } from '@/lib/auth/session'
import { puedeGestionarConfiguracionComercial } from '@/modules/comercial/permisos'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { usernameToInternalEmail, normalizeUsername } from '@/lib/auth-helpers'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const ROL_OPTIONS = [
  { value: 'vendedor',            label: 'Vendedor/a' },
  { value: 'asistente_comercial', label: 'Asistente Comercial' },
  { value: 'gerente_comercial',   label: 'Gerente Comercial' },
]

export default async function NuevoComercialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sesion = await requireModulo('comercial')
  if (!puedeGestionarConfiguracionComercial(sesion)) redirect('/comercial')

  const sp = await searchParams
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null

  async function crearComercial(formData: FormData) {
    'use server'
    const nombre   = String(formData.get('nombre') ?? '').trim()
    const username = normalizeUsername(String(formData.get('username') ?? ''))
    const password = String(formData.get('password') ?? '').trim()
    const rol      = String(formData.get('rol') ?? 'vendedor').trim()

    if (!nombre || !username || !password) {
      redirect('/comercial/configuracion/equipo/nuevo?error=' + encodeURIComponent('Completá todos los campos obligatorios'))
    }
    if (password.length < 6) {
      redirect('/comercial/configuracion/equipo/nuevo?error=' + encodeURIComponent('La contraseña debe tener al menos 6 caracteres'))
    }

    const internalEmail = usernameToInternalEmail(username)
    const admin = createAdminClient()
    let createdUserId: string | null = null

    try {
      const { data, error } = await admin.auth.admin.createUser({
        email: internalEmail,
        password,
        email_confirm: true,
        user_metadata: { nombre, username },
      })

      if (error || !data.user) {
        const msg = error?.message?.includes('already') ? 'Ese usuario ya existe' : (error?.message ?? 'Error al crear usuario')
        redirect('/comercial/configuracion/equipo/nuevo?error=' + encodeURIComponent(msg))
      }

      createdUserId = data.user.id

      const { error: perfilError } = await admin.from('perfiles').insert({
        id: data.user.id,
        nombre,
        rol,
        empresa_acceso: null,
      })

      if (perfilError) {
        await admin.auth.admin.deleteUser(createdUserId)
        redirect('/comercial/configuracion/equipo/nuevo?error=' + encodeURIComponent('No se pudo crear el perfil: ' + perfilError.message))
      }
    } catch (e) {
      if (createdUserId) await admin.auth.admin.deleteUser(createdUserId)
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      redirect('/comercial/configuracion/equipo/nuevo?error=' + encodeURIComponent(msg))
    }

    redirect('/comercial/configuracion?success=comercial_creado')
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/comercial/configuracion" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Agregar comercial</h1>
          <p className="text-sm text-muted-foreground">Crear un nuevo usuario del módulo comercial</p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      <form action={crearComercial} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nombre completo *</label>
          <input
            name="nombre"
            required
            placeholder="Ej: María González"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Usuario (para login) *</label>
          <input
            name="username"
            required
            placeholder="Ej: maria.gonzalez"
            autoComplete="off"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground">Sin espacios ni mayúsculas. El sistema lo normaliza automáticamente.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Contraseña *</label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Rol</label>
          <select
            name="rol"
            defaultValue="vendedor"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {ROL_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/comercial/configuracion" className="text-sm text-muted-foreground hover:text-foreground">
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Crear comercial
          </button>
        </div>
      </form>
    </div>
  )
}
