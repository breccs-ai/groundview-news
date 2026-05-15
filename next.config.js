/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  /**
   * NEXT_PUBLIC_* is exposed to the browser. Server-only secrets (STRIPE_SECRET_KEY,
   * STRIPE_WEBHOOK_SECRET) must stay in environment / deployment config only — do not
   * list them here or they can be bundled for the client.
   */
  env: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
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
    ];
  },
};

module.exports = nextConfig;
