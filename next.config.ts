import type { NextConfig } from "next";
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** Host del storage de Supabase para `next/image` (A6 — otro proyecto = otra env). */
const supabaseImageHost =
  process.env.NEXT_PUBLIC_SUPABASE_IMAGE_HOST?.trim() ||
  'qbbnvdmadgomfmrsfxlo.supabase.co';

const isDev = process.env.NODE_ENV === 'development';

/** P3: sin unsafe-eval en prod; fuentes vía next/font (sin fonts.googleapis.com en runtime). */
function buildContentSecurityPolicy(): string {
  const scriptParts = [
    "'self'",
    "'unsafe-inline'",
    'https://va.vercel-scripts.com',
    ...(isDev ? (["'unsafe-eval'"] as const) : []),
  ];
  return [
    "default-src 'self'",
    [
      'connect-src',
      "'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://*.vercel-insights.com',
      'https://vitals.vercel-insights.com',
      'https://va.vercel-scripts.com',
    ].join(' '),
    "img-src 'self' data: blob: https:",
    `script-src ${scriptParts.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

const nextConfig: NextConfig = {
  experimental: {
    /** Menos JS en el bundle inicial (iconos, gráficos, fechas). */
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: buildContentSecurityPolicy(),
          },
        ],
      },
      {
        // SW siempre fresco: evita clientes con worker viejo indefinidamente.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/favicon.ico',
        destination: '/icon-512.png',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [{ source: '/sitemap.xml', destination: '/sitemap-xml' }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/photo-*',
      },
      {
        protocol: 'https',
        hostname: supabaseImageHost,
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
};

export default withBundleAnalyzer(nextConfig);
