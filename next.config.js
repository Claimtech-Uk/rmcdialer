/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    optimizeCss: false, // Speeds up build
    largePageDataBytes: 512 * 1000, // 512kb threshold
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
  // AWS Amplify optimizations (removed Vercel-specific standalone output)
  trailingSlash: false,
  swcMinify: true,
  poweredByHeader: false,
  
  // Ensure API routes work properly on AWS Amplify
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
}

module.exports = nextConfig