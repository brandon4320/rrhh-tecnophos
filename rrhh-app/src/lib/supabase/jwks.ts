import type { JWK } from '@supabase/supabase-js'

/**
 * Clave PÚBLICA (ES256) con la que Supabase firma los tokens de este proyecto,
 * copiada de /auth/v1/.well-known/jwks.json. Pasándola a getClaims() la firma se
 * verifica sin salir a la red: antes se bajaba el JWKS en casi cada request (las
 * instancias se enfrían seguido y la caché del cliente dura 10 min), dos veces en
 * serie (proxy + getSesion), 230-360 ms en frío.
 * Si Supabase rota la clave, el `kid` del token no va a estar acá y getClaims cae
 * solo a la caché/red: no se rompe, solo vuelve a ser más lento hasta actualizarla.
 */
export const SUPABASE_JWKS: { keys: JWK[] } = {
  keys: [
    {
      alg: 'ES256',
      crv: 'P-256',
      ext: true,
      key_ops: ['verify'],
      kid: 'b9310200-e199-4ab1-9d21-5725bc053f14',
      kty: 'EC',
      use: 'sig',
      x: 'u1a6p827nI4AziKA0ytxQea9nzPR44LC553uwUXhzy0',
      y: 'JnruZ0419TuowulZ3gvybefgT_sbB7sZDHFebSMeb2c',
    },
  ],
}
