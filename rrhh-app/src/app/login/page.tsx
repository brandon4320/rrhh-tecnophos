import { redirect } from 'next/navigation'
import { Building2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeUsername, usernameToInternalEmail } from '@/lib/auth-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const params = (await searchParams) ?? {}

  async function loginAction(formData: FormData) {
    'use server'

    const rawIdentifier = String(formData.get('identifier') ?? '').trim()
    const password = String(formData.get('password') ?? '').trim()

    if (!rawIdentifier || !password) {
      redirect('/login?error=missing')
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
      redirect('/login?error=invalid')
    }

    redirect('/')
  }

  const errorMessage =
    params.error === 'missing'
      ? 'Completá usuario y contraseña.'
      : params.error === 'invalid'
        ? 'Credenciales incorrectas.'
        : null

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestión</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tecnophos · ADC</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Iniciar sesión</CardTitle>
            <CardDescription>Ingresá con tu usuario o email.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={loginAction} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="identifier">Usuario o email</Label>
                <Input
                  id="identifier"
                  name="identifier"
                  required
                  placeholder="nombre.apellido"
                  autoComplete="username"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  {errorMessage}
                </div>
              )}

              <Button type="submit" className="w-full">
                Ingresar
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Sistema interno, uso exclusivo autorizado
        </p>
      </div>
    </div>
  )
}
