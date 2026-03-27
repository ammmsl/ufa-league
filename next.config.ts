import type { NextConfig } from 'next'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

const nextConfig: NextConfig = {
  // Set via NEXT_PUBLIC_BASE_PATH env var (e.g. /league for frisbee.mv/league).
  // Leave unset (empty string) for root deployment on Vercel.
  basePath,

  async headers() {
    return [
      // Security headers on every response
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      // Immutable cache on hashed JS/CSS bundles
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // 1-day cache on the SVG logo
      {
        source: '/bannerlogo.svg',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ]
  },
}

export default nextConfig
