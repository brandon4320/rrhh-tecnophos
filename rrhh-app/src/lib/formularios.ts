// ============================================================
// Piezas compartidas de los formularios de certificados (legajo, vehículos,
// activos, habilitaciones): validación de la ventana de alerta y el
// "abrir el formulario = llevarlo a la vista y poner el foco".
// ============================================================
import { useEffect, useRef } from 'react'
import { ALERTA_DIAS_MAX } from './vencimientos'

export { ALERTA_DIAS_MAX }
export const ALERTA_DIAS_DEFECTO = 30

/** Texto del aviso (no bloqueante) cuando un certificado se guarda sin vencimiento. */
export const AVISO_SIN_VENCIMIENTO = 'Sin fecha de vencimiento no va a avisar cuando venza.'

/**
 * La alerta se edita como TEXTO y se valida al guardar. Antes el input hacía
 * `parseInt(v) || 30` en cada tecla: borrar para escribir "7" lo dejaba en 30 y
 * terminaba guardando 307.
 */
export function validarAlertaDias(raw: string): { ok: true; valor: number } | { ok: false; error: string } {
  const v = raw.trim()
  if (!v) return { ok: false, error: `Indicá con cuántos días de anticipación avisar (1 a ${ALERTA_DIAS_MAX}).` }
  if (!/^\d+$/.test(v)) return { ok: false, error: 'La alerta tiene que ser un número entero de días.' }
  const n = Number(v)
  if (n < 1 || n > ALERTA_DIAS_MAX) return { ok: false, error: `La alerta tiene que ser entre 1 y ${ALERTA_DIAS_MAX} días.` }
  return { ok: true, valor: n }
}

/** Valor inicial del campo de alerta a partir de lo guardado. */
export function alertaComoTexto(alerta: number | null | undefined): string {
  return String(alerta ?? ALERTA_DIAS_DEFECTO)
}

/** Scroll suave hasta el elemento (salta sin animación con "reducir movimiento"). */
export function llevarALaVista(el: HTMLElement, block: ScrollLogicalPosition = 'center') {
  const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block })
}

/**
 * Lleva el formulario a la vista y pone el foco en su primer campo (o en el
 * marcado con `data-autofocus`). Respeta "reducir movimiento" del sistema.
 */
export function enfocarFormulario(el: HTMLElement, block: ScrollLogicalPosition = 'center') {
  llevarALaVista(el, block)
  const campo =
    el.querySelector<HTMLElement>('[data-autofocus]') ??
    el.querySelector<HTMLElement>('input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled)')
  campo?.focus({ preventScroll: true })
}

/**
 * Ref para el contenedor de un formulario que se abre y cierra. Cada vez que
 * cambia `apertura` (un contador que se incrementa al abrir) y hay formulario
 * montado, lo enfoca. Con un booleano no alcanzaba: tocar "Agregar" con el
 * formulario ya abierto no lo volvía a traer.
 */
export function useEnfocarAlAbrir<T extends HTMLElement>(apertura: number, block: ScrollLogicalPosition = 'center') {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (apertura === 0 || !ref.current) return
    enfocarFormulario(ref.current, block)
  }, [apertura, block])
  return ref
}
