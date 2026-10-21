import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeUsername, usernameToInternalEmail } from '@/lib/auth-helpers'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BandaLogin, PortadaLogin } from './Portada'
import { BotonEntrar, CampoClave } from './Campos'

/** Solo rutas internas ("/algo", nunca "//otro-sitio" ni URLs absolutas). */
function destinoSeguro(v: unknown): string {
  const d = typeof v === 'string' ? v : ''
  return d.startsWith('/') && !d.startsWith('//') && !d.startsWith('/\\') ? d : ''
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; next?: string }>
}) {
  const params = (await searchParams) ?? {}
  const next = destinoSeguro(params.next)

  async function loginAction(formData: FormData) {
    'use server'

    const rawIdentifier = String(formData.get('identifier') ?? '').trim()
    const password = String(formData.get('password') ?? '').trim()
    const volverA = destinoSeguro(formData.get('next'))
    const conNext = volverA ? `&next=${encodeURIComponent(volverA)}` : ''

    if (!rawIdentifier || !password) {
      redirect(`/login?error=missing${conNext}`)
    }

    let email = rawIdentifier.toLowerCase()

    if (!rawIdentifier.includes('@')) {
      const normalizedUsername = normalizeUsername(rawIdentifier)

      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const admin = createAdminClient()
          const { data } = await admin.auth.admin.listUsers()
          const matchedUser = (data?.users ?? []).find((authUser) => {
            const metadataUsername = String(authUser.user_metadata?.username ?? '').toLowerCase()
            return metadataUsername === normalizedUsername
          })

          email = matchedUser?.email?.toLowerCase() ?? usernameToInternalEmail(normalizedUsername)
        } catch {
          email = usernameToInternalEmail(normalizedUsername)
        }
      } else {
        email = usernameToInternalEmail(normalizedUsername)
      }
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      redirect(`/login?error=invalid${conNext}`)
    }

    redirect(volverA || '/')
  }

  const errorMessage =
    params.error === 'missing'
      ? 'Completá el usuario y la contraseña.'
      : params.error === 'invalid'
        ? 'El usuario o la contraseña no coinciden. Revisalos y probá de nuevo.'
        : null

  return (
    <div className="min-h-[100dvh] bg-background lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-3 lg:p-3">
      <PortadaLogin />
      <BandaLogin />
      <div className="flex min-h-[calc(100dvh-min(280px,32dvh))] flex-col px-5 lg:min-h-0 lg:px-10">
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-start pt-8 pb-10 lg:justify-center lg:py-10">
          <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Entrar</h2>
          <p className="mt-1.5 text-[15px] text-muted-foreground">Con tu usuario (nombre.apellido) o tu correo.</p>

          <form action={loginAction} className="mt-7 grid gap-4">
            {next && <input type="hidden" name="next" value={next} />}
            <div className="grid gap-1.5">
              <Label htmlFor="identifier" className="text-[13px]">Usuario o correo</Label>
              <Input
                id="identifier"
                name="identifier"
                required
                placeholder="nombre.apellido"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="h-12 text-[15px]"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="password" className="text-[13px]">Contraseña</Label>
              <CampoClave />
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive" role="alert">
                <AlertCircle className="size-4 shrink-0" />
                {errorMessage}
              </div>
            )}

            <BotonEntrar />
          </form>
        </div>
        <p className="pb-8 text-center text-xs text-muted-foreground">¿Problemas para entrar? Pedile ayuda a Brandon.</p>
      </div>
    </div>
  )
}
