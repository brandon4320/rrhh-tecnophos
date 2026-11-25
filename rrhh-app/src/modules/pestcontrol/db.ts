// ============================================================
// Acceso a las tablas pest_*. No están en types/database.ts (mismo criterio que
// arcor_* y comercial_*): el cliente se castea y los tipos viven en reglas.ts.
// Se castea el cliente que se recibe, así la RLS sigue siendo la de la sesión.
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
export function pdb(cliente: unknown): any {
  return cliente
}
/* eslint-enable @typescript-eslint/no-explicit-any */
