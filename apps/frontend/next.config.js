/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  },
  
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