/** @type {import('next').NextConfig} */
const path = require('path');
const fs = require('fs');

// Em produção (Vercel), as variáveis de ambiente vêm do Dashboard. Não carregar .env manualmente aqui.

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // experimental.appDir não é mais necessário nas versões atuais
  // Garantir que as variáveis NEXT_PUBLIC_ sejam expostas ao cliente
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_GATEWAY_URL: process.env.NEXT_PUBLIC_GATEWAY_URL,
    NEXT_PUBLIC_GATEWAY_HTTP_URL: process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL,
    NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    NEXT_PUBLIC_LIVEKIT_API_KEY: process.env.NEXT_PUBLIC_LIVEKIT_API_KEY,
  },
  
  // Permitir acesso de domínios de túnel durante desenvolvimento
  // Evita o aviso: "Cross origin request detected ... configure allowedDevOrigins"
  //allowedDevOrigins: [
  //  'https://*.loca.lt',
  //],
  
  // Variáveis NEXT_PUBLIC_ são automaticamente expostas ao cliente
  
  // Headers para WebRTC e áudio
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless', // Mais permissivo para AudioWorklet
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          // Headers específicos para AudioWorklet
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
          // Priorizar carregamento de fontes
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      // Headers específicos para fontes
      {
        source: '/_next/static/media/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Configurações para audio worklets e WebRTC
  webpack: (config, { isServer }) => {
    // Alias "@" → "src" para garantir resolução consistente em build
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Permitir importação de worklets (apenas se worklet-loader estiver instalado)
    // Comentado para evitar erros de build se não estiver instalado
    // config.module.rules.push({
    //   test: /\.worklet\.(js|ts)$/,
    //   use: {
    //     loader: 'worklet-loader',
    //     options: {
    //       name: 'static/worklets/[name].[hash:8].[ext]',
    //     },
    //   },
    // });

    return config;
  },

  // Configurações de imagens
  images: {
    domains: ['localhost', 'your-domain.com', 'yzjlhezmvdkwdhibyvwh.supabase.co'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'yzjlhezmvdkwdhibyvwh.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Redirects para compatibilidade
  async redirects() {
    return [
      {
        source: '/room/:path*',
        destination: '/call/:path*',
        permanent: true,
      },
    ];
  },

  // Rewrites para API (desabilitado para Vercel - usar variáveis de ambiente)
  // async rewrites() {
  //   return [
  //     {
  //       source: '/api/gateway/:path*',
  //       destination: `${process.env.GATEWAY_URL || 'http://localhost:3001'}/api/:path*`,
  //     },
  //   ];
  // },

  // Configurações de transpilação
  transpilePackages: [
    '@livekit/components-react',
    '@livekit/components-core',
    'livekit-client',
  ],

  // Configurações de output
  // output: 'standalone', // Comentado para Vercel - Vercel usa seu próprio sistema de build
  
  // Configurações de compilação
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Configurações de bundle
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
    },
  },

  // Configurações de ESLint
  eslint: {
    dirs: ['src'],
    ignoreDuringBuilds: true,
  },

  // Configurações de TypeScript
  typescript: {
    // Em produção, pule a checagem de tipos (o SWC ainda transpila TS)
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;