import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Cache de cliente para rutas dinámicas: volver a una empresa visitada hace
    // <30s no toca el server. Las mutaciones ya invalidan con router.refresh().
    staleTimes: { dynamic: 30 },
  },
}

export default nextConfig
