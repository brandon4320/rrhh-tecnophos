import {
  Activity,
  CircleDollarSign,
  Clock,
  FileQuestionMark,
  Gauge,
  MessageCircle,
  PackageCheck,
  Radio,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const MAPA: Record<string, LucideIcon> = {
  contenedor_cargado: PackageCheck,
  contenedor_pendiente: Clock,
  contenedor_descartado: TriangleAlert,
  lectura_dudosa: FileQuestionMark,
  imagen_ignorada: FileQuestionMark,
  whatsapp_estado: MessageCircle,
  claude_credito: CircleDollarSign,
  ocr_claude: Gauge,
  ocr_fallo: ShieldAlert,
  arcor_login: ShieldAlert,
  workflow_error: TriangleAlert,
  conciliacion: RefreshCw,
  publicaciones: Upload,
  sistema_silencio: Radio,
}

/** Ícono por tipo de evento del sistema ARCOR (lucide, nunca emojis). */
export function IconoEvento({ tipo, className }: { tipo: string; className?: string }) {
  const Icono = MAPA[tipo] ?? (tipo.startsWith('contenedor') ? PackageCheck : Activity)
  return <Icono className={cn('size-4', className)} strokeWidth={1.75} />
}
