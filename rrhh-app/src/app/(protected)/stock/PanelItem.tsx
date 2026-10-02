'use client'

import { memo, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { mensajeError } from '@/lib/errores'
import type { StockItem, StockMovimiento } from '@/types'
import { UNIDADES_SUGERIDAS, hoyClave, normalizarNombre, parseCantidad } from '@/modules/stock/reglas'
import { btnPrimary, inputCls, labelCls } from './estilos'

// Mínimo 1 por defecto (criterio acordado el 10/09/2026: avisar cuando queda la última unidad).
const ITEM_VACIO = { nombre: '', categoria: '', unidad: 'unidad', stock_minimo: '1', notas: '', stock_inicial: '' }

interface Props {
  empresa: { id: string; nombre: string }
  /** null = alta. */
  editando: StockItem | null
  items: StockItem[]
  categorias: string[]
  onGuardado: (item: StockItem, movsNuevos: StockMovimiento[], esNuevo: boolean) => void
  onCerrar: () => void
}

/** Alta / edición de un ítem del catálogo (con stock inicial opcional en el alta). */
function PanelItemBase({ empresa, editando, items, categorias, onGuardado, onCerrar }: Props) {
  const [supabase] = useState(() => createClient())
  const [f, setF] = useState(() =>
    editando
      ? {
          nombre: editando.nombre, categoria: editando.categoria ?? '', unidad: editando.unidad ?? 'unidad',
          stock_minimo: editando.stock_minimo != null ? String(editando.stock_minimo) : '', notas: editando.notas ?? '', stock_inicial: '',
        }
      : ITEM_VACIO
  )
  const [saving, setSaving] = useState(false)
  const editandoId = editando?.id ?? null

  async function guardar() {
    if (saving) return
    const nombre = normalizarNombre(f.nombre)
    if (!nombre) return toast.error('El nombre del ítem es obligatorio.')
    const minimo = f.stock_minimo.trim() ? parseCantidad(f.stock_minimo) : 0
    if (minimo == null || minimo < 0) return toast.error('El stock mínimo tiene que ser un número (0 = sin alerta).')
    const inicial = f.stock_inicial.trim() ? parseCantidad(f.stock_inicial) : null
    if (f.stock_inicial.trim() && (inicial == null || inicial < 0)) return toast.error('El stock inicial tiene que ser un número.')
    const duplicado = items.find((i) => i.id !== editandoId && i.nombre.toLowerCase() === nombre.toLowerCase())
    if (duplicado) return toast.error(`Ya existe un ítem llamado "${duplicado.nombre}".`)

    setSaving(true)
    const payload = {
      nombre, categoria: normalizarNombre(f.categoria) || null, unidad: normalizarNombre(f.unidad) || 'unidad',
      stock_minimo: minimo, notas: f.notas.trim() || null,
    }
    // 23505 = ya existe un ítem con ese nombre en la empresa (otro usuario lo creó, o el estado local está viejo).
    const yaExiste = (e: { code?: string } | null) => e?.code === '23505'
    if (editandoId) {
      const { data, error } = await supabase
        .from('stock_items').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editandoId).select().single()
      setSaving(false)
      if (yaExiste(error)) return toast.error(`Ya existe un ítem llamado "${nombre}" en ${empresa.nombre}. Recargá la página.`)
      if (error || !data) return toast.error(mensajeError(error, 'guardar el ítem'))
      toast.success('Ítem actualizado.')
      onGuardado(data, [], false)
      return
    }

    const { data, error } = await supabase.from('stock_items').insert({ ...payload, empresa_id: empresa.id }).select().single()
    if (error || !data) {
      setSaving(false)
      if (yaExiste(error)) return toast.error(`Ya existe un ítem llamado "${nombre}" en ${empresa.nombre}. Recargá la página.`)
      return toast.error(mensajeError(error, 'crear el ítem'))
    }
    let nuevosMovs: StockMovimiento[] = []
    if (inicial && inicial > 0) {
      const { data: m, error: e2 } = await supabase
        .from('stock_movimientos')
        .insert({ item_id: data.id, empresa_id: empresa.id, tipo: 'ajuste', cantidad: inicial, fecha: hoyClave(), notas: 'Stock inicial' })
        .select().single()
      if (e2 || !m) {
        console.error(e2)
        toast.error('El ítem se creó pero no se pudo registrar el stock inicial. Cargalo con "Contar stock".')
      } else nuevosMovs = [m]
    }
    setSaving(false)
    toast.success(`Ítem "${data.nombre}" creado.`)
    onGuardado(data, nuevosMovs, true)
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void guardar() }}
      onKeyDown={(e) => { if (e.key === 'Escape') onCerrar() }}
      className="rounded-xl border border-primary/30 bg-primary/5 p-5"
    >
      <p className="mb-4 text-sm font-medium text-foreground">{editandoId ? 'Editar ítem' : 'Nuevo ítem'}</p>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <label className={labelCls}>Nombre *</label>
          <input type="text" value={f.nombre} onChange={(e) => setF((x) => ({ ...x, nombre: e.target.value }))} className={inputCls} placeholder="Ej: Camisa ADC T 44" autoFocus />
          <p className="mt-1 text-[11px] text-muted-foreground">Para la ropa, terminá el nombre con el talle: &quot;T 44&quot;, &quot;T XL&quot;.</p>
        </div>
        <div>
          <label className={labelCls}>Categoría</label>
          <input type="text" list="stock-categorias" value={f.categoria} onChange={(e) => setF((x) => ({ ...x, categoria: e.target.value }))} className={inputCls} placeholder="Ej: EPP, Ropa, Insumos" />
          <datalist id="stock-categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div>
          <label className={labelCls}>Unidad</label>
          <input type="text" list="stock-unidades" value={f.unidad} onChange={(e) => setF((x) => ({ ...x, unidad: e.target.value }))} className={inputCls} />
          <datalist id="stock-unidades">{UNIDADES_SUGERIDAS.map((u) => <option key={u} value={u} />)}</datalist>
        </div>
        <div>
          <label className={labelCls}>Stock mínimo <span className="font-normal text-muted-foreground">(0 = sin alerta)</span></label>
          <input type="text" inputMode="decimal" value={f.stock_minimo} onChange={(e) => setF((x) => ({ ...x, stock_minimo: e.target.value }))} className={inputCls} placeholder="Ej: 5" />
        </div>
        {!editandoId && (
          <div>
            <label className={labelCls}>Stock inicial <span className="font-normal text-muted-foreground">(lo que hay hoy)</span></label>
            <input type="text" inputMode="decimal" value={f.stock_inicial} onChange={(e) => setF((x) => ({ ...x, stock_inicial: e.target.value }))} className={inputCls} placeholder="Ej: 12" />
          </div>
        )}
        <div className={editandoId ? 'sm:col-span-2' : ''}>
          <label className={labelCls}>Notas</label>
          <input type="text" value={f.notas} onChange={(e) => setF((x) => ({ ...x, notas: e.target.value }))} className={inputCls} placeholder="Marca, presentación, dónde se guarda…" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear ítem'}</button>
        <button type="button" onClick={onCerrar} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
      </div>
    </form>
  )
}

export const PanelItem = memo(PanelItemBase)
