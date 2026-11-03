import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { MENSAJE_LINK_INVALIDO } from '@/modules/recibos/reglas'
import { buscarToken, estadoDe } from '@/modules/recibos/servidor'
import FormularioFirma from './FormularioFirma'

// Página PÚBLICA: la abre el empleado desde el link de su mail. Sin login.
// Todo lo que se lee acá pasa por el token (service role), y no se muestra
// NADA de la persona hasta que confirma los últimos 4 de su CUIL.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Mis recibos de sueldo',
  robots: { index: false, follow: false },
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-4 py-10">
      <header className="mb-7">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gestión de Recursos</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em]">Recibos de sueldo</h1>
      </header>
      {children}
    </main>
  )
}

export default async function FirmaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  let fila
  try {
    fila = await buscarToken(admin, token)
  } catch {
    // Que la base esté caída NO puede verse igual que un link vencido: el
    // empleado tiene que saber que el problema es nuestro y volver a intentar.
    return (
      <Marco>
        <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-tarjeta">
          <p className="text-sm font-medium">El sistema no está disponible</p>
          <p className="mt-1 text-sm text-muted-foreground">Probá de nuevo en unos minutos.</p>
        </div>
      </Marco>
    )
  }

  // Inexistente, vencido o revocado: el MISMO mensaje. Si se distinguieran, se
  // podría averiguar qué links existen probando al azar.
  if (!fila || estadoDe(fila) === 'invalido') {
    return (
      <Marco>
        <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-tarjeta">
          <p className="text-sm font-medium">Este link no sirve</p>
          <p className="mt-1 text-sm text-muted-foreground">{MENSAJE_LINK_INVALIDO}</p>
        </div>
      </Marco>
    )
  }

  return (
    <Marco>
      <FormularioFirma token={token} />
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Si no reconocés este mensaje, avisale a administración.
      </p>
    </Marco>
  )
}
