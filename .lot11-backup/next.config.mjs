/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'stream.broadcastsn.com',
      },
    ],
  },
  compress: true,
  poweredByHeader: false,
  trailingSlash: false,
  experimental: {
    turbopackMemoryLimit: 512,
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/_next/image',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Ne pas utiliser `source: "/:path*"` avec Cache-Control no-store : en Next.js 16 la
      // règle s’applique aussi à `/_next/static/*` (en plus de la règle ci-dessus) et fait
      // renvoyer des 500 sur les chunks CSS/JS. Le HTML peut être contrôlé côté Nginx si besoin
      // (add_header Cache-Control pour location / sans _next).
    ]
  },
}

export default nextConfig
