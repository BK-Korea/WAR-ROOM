/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'pg'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('better-sqlite3', 'pg-native');
    }
    return config;
  },
};

export default nextConfig;
