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
      <div className="rounded-xl border border-dashed border-border px-5 py-6 text-center text-sm text-muted-foreground">
        Sin contenedores con esos filtros.
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-border bg-card shadow-tarjeta md:overflow-x-auto">
      {/* En el celular cada contenedor es una tarjeta de tres renglones: nada se desliza de costado. */}
      <Table className="max-md:block">
        <TableHeader className="max-md:hidden">
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
        <TableBody className="max-md:block">
          {items.map((c) => {
            const dias = diasDesde(c.fecha, hoy)
            const espera = (ESTADOS_ABIERTOS as readonly string[]).includes(c.estado)
            const demorado = espera && dias > DIAS_DEMORA
            return (
              <TableRow key={c.id} className="max-md:grid max-md:grid-cols-[auto_auto_minmax(0,1fr)_auto] max-md:items-center max-md:gap-x-2 max-md:gap-y-1 max-md:px-4 max-md:py-2.5 [&>td]:max-md:p-0 [&>td]:max-md:whitespace-normal">
                <TableCell className="tabular-nums text-muted-foreground max-md:col-start-1 max-md:row-start-2 max-md:text-xs">{fmtFechaAR(c.fecha)}</TableCell>
                <TableCell
                  className={cn('tabular-nums max-md:col-start-2 max-md:row-start-2 max-md:text-xs', demorado ? 'font-medium text-warning' : 'text-muted-foreground')}
                  title={demorado ? `Espera hace ${etiquetaDias(dias)}` : undefined}
                >
                  {etiquetaDias(dias)}
                </TableCell>
                <TableCell className="font-mono text-sm font-medium max-md:col-span-3 max-md:col-start-1 max-md:row-start-1">{c.contenedor}</TableCell>
                <TableCell className="max-md:col-start-3 max-md:row-start-2 max-md:truncate max-md:text-xs">{tituloLugar(c.lugar)}</TableCell>
                <TableCell className="font-mono text-xs max-md:col-span-2 max-md:col-start-1 max-md:row-start-3"><span className="font-sans text-muted-foreground md:hidden">Booking </span>{c.booking ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="font-mono text-xs max-md:col-span-2 max-md:col-start-3 max-md:row-start-3"><span className="font-sans text-muted-foreground md:hidden">OE </span>{c.oe ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="max-md:col-start-4 max-md:row-start-1 max-md:justify-self-end">
                  <EstadoPill estado={estadoContenedorAEstado(c.estado)} label={ESTADO_CONTENEDOR_LABEL[c.estado]} />
                </TableCell>
                <TableCell className="text-center max-md:col-start-4 max-md:row-start-2 max-md:justify-self-end">
                  {c.publicado ? (
                    <CircleCheck className="mx-auto size-4 text-success" strokeWidth={1.75} aria-label="Publicado en Colabora" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground max-md:col-span-4 max-md:max-w-none max-md:empty:hidden" title={c.observaciones ?? undefined}>
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
