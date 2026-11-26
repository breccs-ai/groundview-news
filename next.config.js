/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vnpwmgfxxfmjdebqrdhi.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  /**
   * NEXT_PUBLIC_* is exposed to the browser. Server-only secrets (STRIPE_SECRET_KEY,
   * STRIPE_WEBHOOK_SECRET) must stay in environment / deployment config only — do not
   * list them here or they can be bundled for the client.
   */
  env: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  // Baseline browser protections on every response. A Content-Security-Policy is not
  // set here yet: the site loads Stripe, ad and analytics scripts, so a policy needs
  // to be built and trialled in report-only mode before it is enforced.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/advertise/register',
        destination: '/advertiser/register',
        permanent: true,
      },
      {
        source: '/advertise/login',
        destination: '/advertiser/dashboard',
        permanent: true,
      },
      {
        source: '/advertise/dashboard',
        destination: '/advertiser/dashboard',
        permanent: true,
      },
      {
        source: '/advertise/new',
        destination: '/advertiser/create-ad',
        permanent: true,
      },
      {
        source: '/advertise/success',
        destination: '/advertiser/dashboard',
        permanent: true,
      },
      {
        source: '/article/:slug*',
        destination: '/articles/:slug*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
