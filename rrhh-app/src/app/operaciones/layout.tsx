import Link from 'next/link'
import { requireModulo } from '@/lib/auth/session'

export default async function OperacionesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Exige acceso al módulo (roles: admin, admin_adc, supervisor, operario, admin_unipar).
  await requireModulo('limpieza')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Inicio
          </Link>
          <div className="h-6 w-px bg-gray-200" />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 leading-tight">Operaciones</p>
            <p className="text-xs text-gray-500 truncate">Contrato UNIPAR · Bahía Blanca</p>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  )
}
