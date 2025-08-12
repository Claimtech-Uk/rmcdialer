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
  // Enable standalone output for Vercel
  output: 'standalone',
  // Optimize build performance
  swcMinify: true,
  poweredByHeader: false,
  // CRITICAL: Exclude heavy API routes from static generation
  exportPathMap: async function(defaultPathMap) {
    const excludeRoutes = [
      '/api/cron/callback-notifications',
      '/api/cron/discover-new-requirements', 
      '/api/cron/smart-new-users-discovery',
      '/api/cron/sms-followups',
      '/api/debug/all-callbacks',
      '/api/callbacks/overdue',
      '/api/agents/*/pending-callbacks'
    ];
    
    // Remove excluded routes from static generation
    const filteredPathMap = { ...defaultPathMap };
    excludeRoutes.forEach(route => {
      delete filteredPathMap[route];
    });
    
    return filteredPathMap;
  }
}

module.exports = nextConfig