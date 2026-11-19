'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Certificate, FireExtinguisher, MagnifyingGlass, Truck } from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { traerTodo } from '@/lib/paginar'
import { coincide } from '@/lib/texto'
import { cn } from '@/lib/utils'
import { Hoja, HojaCabecera } from '@/components/ui/hoja'
import { AvatarPersona, Cuadro, IconoEmpresa, nombreCorto } from '@/components/ui/empresa'
import { esPala } from '@/modules/palas/reglas'
import type { EmpresaInicio } from './tipos'

interface Titular {
  key: string
  tipo: 'persona' | 'vehiculo' | 'equipo' | 'empresa'
  texto: string
  detalle: string
  slug: string
  /** El formulario de certificados de siempre de ese titular. */
  href: string
}

/**
 * "Cargar certificado" del Inicio: elegir a quién es (persona, vehículo, equipo o la
 * empresa) y seguir al formulario de siempre de ese titular, con el alta abierta.
 * No escribe nada acá: la carga, la validación y la RLS son las del legajo, Habilitaciones
 * o Palas. Solo lee la lista de titulares (cliente del navegador, la RLS decide).
 */
export function CargarCertificado({ abierta, onCerrar, empresas }: { abierta: boolean; onCerrar: () => void; empresas: EmpresaInicio[] }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [activo, setActivo] = useState(0)
  const [lista, setLista] = useState<Titular[] | null>(null)
  const [error, setError] = useState(false)
  const pedido = useRef('')
  const ids = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas])
  const clave = empresas.map((e) => e.id).join(',')

  useEffect(() => {
    if (!abierta || pedido.current === clave) return
    pedido.current = clave
    const supabase = createClient()
    const idsLista = [...ids.keys()]
    Promise.all([
      traerTodo((d, h) => supabase.from('empleados').select('id, nombre, apellido, sector, empresa_id').eq('activo', true).in('empresa_id', idsLista).order('id').range(d, h)),
      traerTodo((d, h) => supabase.from('vehiculos').select('id, patente, marca, modelo, empresa_id').eq('activo', true).in('empresa_id', idsLista).order('id').range(d, h)),
      traerTodo((d, h) => supabase.from('equipos').select('id, nombre, categoria, empresa_id').in('empresa_id', idsLista).order('id').range(d, h)),
    ]).then(([p, v, q2]) => {
      if (p.error || v.error || q2.error) { setError(true); return }
      const out: Titular[] = []
      for (const e of p.data) {
        const emp = ids.get(e.empresa_id ?? '')
        if (!emp) continue
        out.push({ key: `p${e.id}`, tipo: 'persona', texto: [e.nombre, e.apellido].filter(Boolean).join(' '), detalle: nombreCorto(emp.nombre), slug: emp.slug, href: `/legajo/${e.id}?cargar=1` })
      }
      for (const x of v.data) {
        const emp = ids.get(x.empresa_id ?? '')
        if (!emp) continue
        out.push({ key: `v${x.id}`, tipo: 'vehiculo', texto: [x.marca, x.modelo, x.patente].filter(Boolean).join(' · ') || 'Vehículo', detalle: nombreCorto(emp.nombre), slug: emp.slug, href: `/empresa/${emp.slug}?vista=documentacion&veh=${x.id}` })
      }
      for (const x of q2.data) {
        const emp = ids.get(x.empresa_id ?? '')
        if (!emp) continue
        out.push({ key: `q${x.id}`, tipo: 'equipo', texto: x.nombre, detalle: nombreCorto(emp.nombre), slug: emp.slug, href: esPala(x.categoria) ? `/palas?empresa=${emp.slug}&pala=${x.id}` : `/empresa/${emp.slug}?vista=documentacion&equipo=${x.id}` })
      }
      for (const emp of empresas) out.push({ key: `e${emp.id}`, tipo: 'empresa', texto: emp.nombre, detalle: 'Habilitaciones', slug: emp.slug, href: `/empresa/${emp.slug}?vista=documentacion` })
      setLista(out)
    })
  }, [abierta, clave, ids, empresas])

  const res = useMemo(() => (lista ?? []).filter((t) => coincide(q, t.texto, t.detalle)).slice(0, 8), [lista, q])
  const sel = Math.min(activo, Math.max(0, res.length - 1))

  function elegir(t: Titular | undefined) {
    if (!t) return
    onCerrar()
    setQ('')
    router.push(t.href)
  }

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} etiqueta={{ id: 'hoja-cargar' }}>
      <HojaCabecera
        tituloId="hoja-cargar"
        rotulo="Personas, vehículos, equipos o empresa"
        titulo="Cargar certificado"
        onCerrar={onCerrar}
        tile={<Cuadro color="var(--primary)"><Certificate size={18} /></Cuadro>}
      />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4 md:p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cTit" className="text-[13px] font-medium text-texto-2">Titular</label>
          <div className="flex h-[52px] items-center gap-2 rounded-xl border border-border-strong bg-card px-3 shadow-min transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_16%,transparent)] md:h-10">
            <MagnifyingGlass size={17} className="text-muted-foreground" aria-hidden />
            <input
              id="cTit"
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls="cSug"
              autoComplete="off"
              value={q}
              onChange={(e) => { setQ(e.target.value); setActivo(0) }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (res.length) setActivo((sel + (e.key === 'ArrowDown' ? 1 : -1) + res.length) % res.length) }
                if (e.key === 'Enter') { e.preventDefault(); elegir(res[sel]) }
              }}
              placeholder="Ej.: Juan Pérez, AF 482 TK o Matafuego"
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-base outline-none md:text-sm"
            />
          </div>
        </div>
        <div id="cSug" role="listbox" aria-label="Titulares" className="flex flex-col gap-0.5">
          {error && <p className="p-3 text-[13px] text-danger">No se pudo leer la lista de titulares.</p>}
          {!error && !lista && <p className="p-3 text-[13px] text-texto-2">Buscando titulares…</p>}
          {lista && res.length === 0 && <p className="p-3 text-[13px] text-texto-2">No hay nadie con «{q}»</p>}
          {res.map((t, i) => (
            <button key={t.key} type="button" role="option" aria-selected={i === sel} onMouseEnter={() => setActivo(i)} onClick={() => elegir(t)} className={cn('flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-[10px] px-2 text-left text-[13px]', i === sel && 'bg-muted')}>
              {t.tipo === 'persona' ? <AvatarPersona nombre={t.texto} slug={t.slug} tamano={28} />
                : t.tipo === 'empresa' ? <IconoEmpresa slug={t.slug} nombre={t.texto} tamano={28} />
                : <Cuadro color={t.tipo === 'vehiculo' ? 'var(--f-log)' : 'var(--f-ope)'} tamano={28}>{t.tipo === 'vehiculo' ? <Truck size={15} /> : <FireExtinguisher size={15} />}</Cuadro>}
              <span className="min-w-0 flex-1 truncate">{t.texto}</span>
              <small className="text-xs text-muted-foreground">{t.detalle}</small>
              {i === sel && <ArrowRight size={14} className="text-muted-foreground" aria-hidden />}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-divisor bg-bandeja px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:px-5 md:pb-3">
        <span className="mr-auto text-[13px] text-texto-2">Sigue en su formulario de siempre</span>
        <button type="button" onClick={onCerrar} className="inline-flex h-[46px] cursor-pointer items-center rounded-xl border border-border bg-card px-4 text-sm font-medium shadow-min hover:bg-hover md:h-[38px]">Cancelar</button>
      </div>
    </Hoja>
  )
}
