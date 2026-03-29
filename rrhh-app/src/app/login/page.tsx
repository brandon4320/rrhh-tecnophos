import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeUsername, usernameToInternalEmail } from '@/lib/auth-helpers'

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

    redirect('/dashboard')
  }

  const errorMessage =
    params.error === 'missing'
      ? 'Completá usuario y contraseña.'
      : params.error === 'invalid'
        ? 'Credenciales incorrectas.'
        : null

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">RRHH</h1>
          <p className="text-sm text-gray-500 mt-1">Tecnophos · ADC</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Iniciar sesión</h2>

          <form action={loginAction} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Usuario o email
              </label>
              <input
                type="text"
                name="identifier"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                placeholder="usuario"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors mt-2"
            >
              Ingresar
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Sistema interno, uso exclusivo autorizado
        </p>
      </div>
    </div>
  )
}
