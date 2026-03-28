import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RRHH — Tecnophos / ADC',
  description: 'Sistema de gestión de personal y vencimientos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  )
}
