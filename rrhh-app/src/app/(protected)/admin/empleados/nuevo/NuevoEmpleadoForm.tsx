'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { crearEmpleado } from './actions'
import { estadoInicial } from './estado'

// Campo de la skill: 40 px (52 en celular), borde fuerte, foco con halo del acento.
const inputCls =
  'h-[52px] w-full rounded-xl border border-border-strong bg-card px-3 text-base shadow-min outline-none transition-[border-color,box-shadow] focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_16%,transparent)] md:h-10 md:text-sm'
const rotuloCls = 'mb-1.5 block text-[13px] font-medium text-texto-2'

interface Props {
  empresas: { id: string; nombre: string; slug: string }[]
  empresaInicial: string
  sectores: string[]
  volverA: string
  /** En la hoja lateral de Empleados: Cancelar cierra la hoja en vez de navegar. */
  onCancelar?: () => void
}

export default function NuevoEmpleadoForm({ empresas, empresaInicial, sectores, volverA, onCancelar }: Props) {
  const [estado, accion, enviando] = useActionState(crearEmpleado, estadoInicial(empresaInicial))
  const v = estado.valores

  return (
    <div className={onCancelar ? 'flex min-h-0 flex-1 flex-col' : 'rounded-2xl border border-border bg-card p-6'}>
      <div className={onCancelar ? 'flex-1 overflow-y-auto overscroll-contain p-4 md:p-5' : ''}>
      {estado.error && (
        <div role="alert" className="mb-5 rounded-[16px] border border-[color-mix(in_oklch,var(--danger)_22%,transparent)] bg-danger-subtle px-4 py-3 text-[13px] text-danger">
          <p>{estado.error}</p>
          {estado.duplicado && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                href={`/legajo/${estado.duplicado.id}`}
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
              >
                {estado.duplicado.activo ? 'Abrir su legajo' : 'Abrir su legajo para reactivarlo'}
              </Link>
              <span className="text-muted-foreground">o, si es otra persona con el mismo nombre,</span>
              <button
                type="submit"
                form="form-nuevo-empleado"
                name="forzar"
                value="1"
                disabled={enviando}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Crear igual
              </button>
            </div>
          )}
        </div>
      )}

      {/* key = intento: después de cada respuesta del server el form se remonta con
          lo que se mandó (React 19 resetea los campos al terminar la acción y antes
          un error de validación borraba todo lo tipeado). */}
      <form key={estado.intento} id="form-nuevo-empleado" action={accion} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="nombre" className={rotuloCls}>Nombre</label>
            <input
              id="nombre"
              type="text"
              name="nombre"
              required
              autoFocus
              defaultValue={v.nombre}
              className={inputCls}
              placeholder="Ej.: Juan"
            />
          </div>

          <div>
            <label htmlFor="apellido" className={rotuloCls}>Apellido</label>
            <input
              id="apellido"
              type="text"
              name="apellido"
              defaultValue={v.apellido}
              className={inputCls}
              placeholder="Ej.: Pérez"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="empresa_id" className={rotuloCls}>Empresa</label>
            <select id="empresa_id" name="empresa_id" required defaultValue={v.empresa_id} className={inputCls}>
              <option value="" disabled>
                Seleccionar empresa
              </option>
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sector" className={rotuloCls}>Sector</label>
            <input
              id="sector"
              type="text"
              name="sector"
              list="sectores-existentes"
              defaultValue={v.sector}
              autoComplete="off"
              className={inputCls}
              placeholder="Ej.: Fumigación"
            />
            <datalist id="sectores-existentes">
              {sectores.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>

      </form>
      </div>
      <div className={onCancelar ? 'flex items-center justify-end gap-2 border-t border-divisor bg-bandeja px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:px-5 md:pb-3' : 'mt-5 flex items-center justify-end gap-2'}>
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className="inline-flex h-[46px] flex-1 cursor-pointer items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-medium shadow-min hover:bg-hover md:h-[38px] md:flex-none">
            Cancelar
          </button>
        ) : (
          <Link href={volverA} className="inline-flex h-[38px] items-center rounded-xl border border-border bg-card px-4 text-sm font-medium shadow-min hover:bg-hover">
            Cancelar
          </Link>
        )}
        <button
          type="submit"
          form="form-nuevo-empleado"
          disabled={enviando}
          className="inline-flex h-[46px] flex-1 cursor-pointer items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-principal transition-[background-color,transform] hover:bg-primary-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 md:h-[38px] md:flex-none dark:bg-foreground dark:text-card"
        >
          {enviando ? 'Guardando…' : 'Guardar y cargar certificados'}
        </button>
      </div>
    </div>
  )
}
