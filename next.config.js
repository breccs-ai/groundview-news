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
};

module.exports = nextConfig;
