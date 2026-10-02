'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { crearEmpleado } from './actions'
import { estadoInicial } from './estado'

const inputCls =
  'w-full px-3.5 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring'

interface Props {
  empresas: { id: string; nombre: string; slug: string }[]
  empresaInicial: string
  sectores: string[]
  volverA: string
}

export default function NuevoEmpleadoForm({ empresas, empresaInicial, sectores, volverA }: Props) {
  const [estado, accion, enviando] = useActionState(crearEmpleado, estadoInicial(empresaInicial))
  const v = estado.valores

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      {estado.error && (
        <div role="alert" className="mb-5 rounded-xl border border-danger/30 bg-danger-subtle px-4 py-3 text-sm text-danger">
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
      <form key={estado.intento} id="form-nuevo-empleado" action={accion} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-foreground mb-1.5">Nombre *</label>
            <input
              id="nombre"
              type="text"
              name="nombre"
              required
              autoFocus
              defaultValue={v.nombre}
              className={inputCls}
              placeholder="Nombre"
            />
          </div>

          <div>
            <label htmlFor="apellido" className="block text-sm font-medium text-foreground mb-1.5">Apellido</label>
            <input
              id="apellido"
              type="text"
              name="apellido"
              defaultValue={v.apellido}
              className={inputCls}
              placeholder="Apellido"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="empresa_id" className="block text-sm font-medium text-foreground mb-1.5">Empresa *</label>
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
            <label htmlFor="sector" className="block text-sm font-medium text-foreground mb-1.5">Sector</label>
            <input
              id="sector"
              type="text"
              name="sector"
              list="sectores-existentes"
              defaultValue={v.sector}
              autoComplete="off"
              className={inputCls}
              placeholder="Elegí uno existente o escribí uno nuevo"
            />
            <datalist id="sectores-existentes">
              {sectores.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={volverA}
            className="px-4 py-2.5 rounded-lg border border-input text-sm font-medium text-foreground hover:bg-accent"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={enviando}
            className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {enviando ? 'Guardando...' : 'Guardar y cargar certificados'}
          </button>
        </div>
      </form>
    </div>
  )
}
