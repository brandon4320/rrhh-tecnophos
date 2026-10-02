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
  title: 'Gestión · Tecnophos / ADC',
  description: 'Sistema de gestión modular (RRHH, Operaciones)',
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
          <Toaster richColors position="top-center" />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  )
}
