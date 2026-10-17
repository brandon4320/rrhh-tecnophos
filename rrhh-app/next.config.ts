import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Cache de cliente para rutas dinámicas: volver a una empresa visitada hace
    // <30s no toca el server. Las mutaciones ya invalidan con router.refresh().
    staleTimes: { dynamic: 30 },
  },
  // Sistema interno: que ningún buscador lo liste (gestion.tecnophos.com.ar ni la de vercel.app).
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }] }]
  },
}

export default nextConfig
