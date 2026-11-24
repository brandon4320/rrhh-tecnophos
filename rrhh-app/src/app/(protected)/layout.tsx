import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, RRHH_ROLES } from '@/lib/auth/roles'
import AppShell, { type EmpresaNav } from '@/components/layout/AppShell'
import { puedeVerArcor } from '@/modules/arcor/acceso'
import { traerTodo } from '@/lib/paginar'
import { fechaMasDias } from '@/lib/vencimientos'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // Sesión y empresas en paralelo (1 solo round-trip serial). El scope por
  // empresa_acceso lo aplica la RLS, así que la query no depende de la sesión:
  // sin sesión o rol no-RRHH devuelve vacío y se redirige igual. El conteo de
  // empleados activos viene embebido (también filtrado por la RLS de empleados)
  // en vez de traer todas las filas para contarlas acá.
  // Los vencidos (fecha < hoy en AR) cuentan en el menú y en la campana de avisos, con la misma
  // regla del Inicio: los de empleados dados de baja no cuentan. La RLS limita a lo que cada uno ve.
  const [sesion, { data: empresas }, vencidos] = await Promise.all([
    getSesion(),
    supabase.from('empresas').select('id, nombre, slug, empleados(count)').eq('empleados.activo', true).order('nombre'),
    traerTodo((d, h) =>
      supabase
        .from('certificados')
        .select('id, empresa_id, empleado:empleados(activo, empresa_id), vehiculo:vehiculos(empresa_id), equipo:equipos(empresa_id)')
        .lt('fecha_vencimiento', fechaMasDias(0))
        .order('id')
        .range(d, h)
    ),
  ])

  if (!sesion) redirect('/login')

  // Acceso a RRHH solo para roles RRHH (admin/usuario). El resto
  // va a su módulo — no puede entrar a las pantallas de RRHH.
  if (!tieneRol(sesion.rol, RRHH_ROLES)) redirect('/')

  // Un conteo del menú que no se pudo leer no frena la pantalla: queda sin número y se avisa en el log.
  if (vencidos.error) console.warn('[layout] vencidos del menú:', vencidos.error.message)
  const vencidosPorEmpresa = new Map<string, number>()
  for (const c of vencidos.data ?? []) {
    const empleado = Array.isArray(c.empleado) ? c.empleado[0] : c.empleado
    const vehiculo = Array.isArray(c.vehiculo) ? c.vehiculo[0] : c.vehiculo
    const equipo = Array.isArray(c.equipo) ? c.equipo[0] : c.equipo
    if (empleado && empleado.activo === false) continue
    const empresaId = empleado?.empresa_id ?? vehiculo?.empresa_id ?? equipo?.empresa_id ?? c.empresa_id
    if (empresaId) vencidosPorEmpresa.set(empresaId, (vencidosPorEmpresa.get(empresaId) ?? 0) + 1)
  }

  // Empleados activos y vencidos por empresa, para el selector y los conteos del menú.
  const nav: EmpresaNav[] = (empresas ?? []).map((e) => ({
    id: e.id,
    nombre: e.nombre,
    slug: e.slug,
    total: (e.empleados as { count: number }[] | null)?.[0]?.count ?? 0,
    vencidos: vencidosPorEmpresa.get(e.id) ?? 0,
  }))

  return (
    <AppShell
      empresas={nav}
      arcor={puedeVerArcor(sesion)}
      sesion={{ nombre: sesion.nombre, email: sesion.email, rol: sesion.rol, superAdmin: sesion.rol === 'admin' && !sesion.empresaAcceso, veRecibos: sesion.veRecibos }}
    >
      {children}
    </AppShell>
  )
}
