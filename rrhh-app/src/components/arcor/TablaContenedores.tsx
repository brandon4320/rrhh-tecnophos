import { CircleCheck } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EstadoPill } from '@/components/ui/estado-pill'
import type { ContenedorRow } from '@/modules/arcor/tipos'
import {
  DIAS_DEMORA, ESTADOS_ABIERTOS, ESTADO_CONTENEDOR_LABEL, diasDesde, estadoContenedorAEstado, etiquetaDias, tituloLugar,
} from '@/modules/arcor/reglas'
import { fmtFechaAR } from '@/lib/fechas-ar'
import { cn } from '@/lib/utils'

/**
 * `hoy` ('YYYY-MM-DD' en hora AR, calculado en el server) alimenta la columna
 * "Hace": días desde la fecha del certificado. En los que esperan a alguien
 * (pendiente ARCOR / revisar foto) se resalta pasados DIAS_DEMORA días.
 */
export function TablaContenedores({ items, hoy }: { items: ContenedorRow[]; hoy: string }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
        Sin contenedores con esos filtros.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Fecha</TableHead>
            <TableHead className="w-20">Hace</TableHead>
            <TableHead>Contenedor</TableHead>
            <TableHead>Lugar</TableHead>
            <TableHead>Booking</TableHead>
            <TableHead>OE</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-center">Colabora</TableHead>
            <TableHead>Observaciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => {
            const dias = diasDesde(c.fecha, hoy)
            const espera = (ESTADOS_ABIERTOS as readonly string[]).includes(c.estado)
            const demorado = espera && dias > DIAS_DEMORA
            return (
              <TableRow key={c.id}>
                <TableCell className="tabular-nums text-muted-foreground">{fmtFechaAR(c.fecha)}</TableCell>
                <TableCell
                  className={cn('tabular-nums', demorado ? 'font-medium text-warning' : 'text-muted-foreground')}
                  title={demorado ? `Espera hace ${etiquetaDias(dias)}` : undefined}
                >
                  {etiquetaDias(dias)}
                </TableCell>
                <TableCell className="font-mono text-sm font-medium">{c.contenedor}</TableCell>
                <TableCell>{tituloLugar(c.lugar)}</TableCell>
                <TableCell className="font-mono text-xs">{c.booking ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="font-mono text-xs">{c.oe ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <EstadoPill estado={estadoContenedorAEstado(c.estado)} label={ESTADO_CONTENEDOR_LABEL[c.estado]} />
                </TableCell>
                <TableCell className="text-center">
                  {c.publicado ? (
                    <CircleCheck className="mx-auto size-4 text-success" strokeWidth={1.75} aria-label="Publicado en Colabora" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground" title={c.observaciones ?? undefined}>
                  {c.observaciones ?? ''}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
