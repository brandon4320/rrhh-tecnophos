'use client'

// Empleado (opcional) o nombre: el campo Nombre aparece solo si no se eligió un empleado, así la
// pantalla no necesita aclaraciones. El server action (crearUsuario) toma el nombre del empleado si
// viene `empleado_id`; si no, exige `nombre`.
import { useState } from 'react'

export interface OpcionEmpleado {
  id: string
  etiqueta: string
}

const campo = 'w-full px-3.5 py-2.5 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring'

export function QuienEs({ empleados }: { empleados: OpcionEmpleado[] }) {
  const [empleadoId, setEmpleadoId] = useState('')
  return (
    <>
      <div className={empleadoId ? 'md:col-span-2' : undefined}>
        <label htmlFor="empleado_id" className="block text-sm font-medium text-foreground mb-1.5">Empleado</label>
        <select id="empleado_id" name="empleado_id" value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} className={campo}>
          <option value="">Ninguno</option>
          {empleados.map((e) => (
            <option key={e.id} value={e.id}>
              {e.etiqueta}
            </option>
          ))}
        </select>
      </div>
      {!empleadoId && (
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-foreground mb-1.5">Nombre</label>
          <input id="nombre" type="text" name="nombre" required autoComplete="off" className={campo} placeholder="Marcelo Pérez" />
        </div>
      )}
    </>
  )
}
