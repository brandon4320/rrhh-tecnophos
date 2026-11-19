import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'sonner'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

// La mono solo se usa en patentes/códigos: no se precarga en todas las páginas.
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  preload: false,
})

export const metadata: Metadata = {
  title: 'Gestión de Recursos',
  description: 'Personal, vencimientos, flota y stock de Tecnophos, ADC y Serviwhite',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          {/* Aviso de la skill: oscuro abajo a la derecha (claro en el tema oscuro), con su acción. */}
          <Toaster
            position="bottom-right"
            offset={28}
            mobileOffset={{ bottom: 'calc(96px + env(safe-area-inset-bottom))', left: 16, right: 16 }}
            toastOptions={{
              style: {
                background: 'var(--tip)',
                color: 'var(--tip-foreground)',
                border: '0',
                borderRadius: 16,
                boxShadow: 'var(--sombra-flotante)',
              },
              classNames: {
                description: '!text-tip-2',
                actionButton: '!bg-transparent !text-tip-foreground hover:!bg-white/10 !font-medium',
                error: '[&_[data-icon]]:!text-rojo-g',
                success: '[&_[data-icon]]:!text-verde-g',
              },
            }}
          />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  )
}
