/** Estado del formulario de alta (useActionState). Vive aparte porque un
 *  archivo 'use server' solo puede exportar funciones async. */
export interface EstadoAlta {
  /** Sube en cada respuesta del server: remonta el form con los valores devueltos. */
  intento: number
  error?: string
  /** Lo que se mandó: si algo falla, el formulario vuelve con lo tipeado. */
  valores: { nombre: string; apellido: string; empresa_id: string; sector: string }
  /** Ya hay alguien con ese nombre en la empresa (activo o dado de baja). */
  duplicado?: { id: string; nombreCompleto: string; activo: boolean }
}

export function estadoInicial(empresaId: string): EstadoAlta {
  return { intento: 0, valores: { nombre: '', apellido: '', empresa_id: empresaId, sector: '' } }
}
