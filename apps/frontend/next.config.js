/** @type {import('next').NextConfig} */
const path = require('path');
const fs = require('fs');

// Carregar .env.local explicitamente
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  //console.log('[DEBUG] .env.local carregado:', {
  //  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'present' : 'missing',
  //  SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'present' : 'missing',
  //});
} else {
  console.error('[ERROR] .env.local não encontrado em:', envPath);
}

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
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },

  // Configurações para audio worklets e WebRTC
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Permitir importação de worklets
    config.module.rules.push({
      test: /\.worklet\.(js|ts)$/,
      use: {
        loader: 'worklet-loader',
        options: {
          name: 'static/worklets/[name].[hash:8].[ext]',
        },
      },
    });

    return config;
  },

  // Configurações de imagens
  images: {
    domains: ['localhost', 'your-domain.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'your-project.supabase.co',
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

  // Rewrites para API
  async rewrites() {
    return [
      {
        source: '/api/gateway/:path*',
        destination: `${process.env.GATEWAY_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },

  // Configurações de transpilação
  transpilePackages: [
    '@livekit/components-react',
    '@livekit/components-core',
    'livekit-client',
  ],

  // Configurações de output
  output: 'standalone',
  
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
    ignoreDuringBuilds: false,
  },

  // Configurações de TypeScript
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;