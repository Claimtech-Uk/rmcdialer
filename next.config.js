/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  typescript: {
    // WARNING: This allows production builds to complete even with type errors.
    // Only use this for urgent deployments while fixing schema issues.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to complete even with lint errors.
    ignoreDuringBuilds: true,
  },
  // Enable standalone output for Vercel
  output: 'standalone',
}

module.exports = nextConfig