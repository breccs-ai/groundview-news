import type { MetadataRoute } from 'next';

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://groundviewnews.com').replace(/\/$/, '');
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/dashboard',
        '/submit',
        '/advertiser/dashboard',
        '/advertiser/create-ad',
        '/advertiser/reset-password',
        '/journalists/dashboard',
        '/journalists/submit',
        '/journalists/articles',
        '/journalists/feedback',
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
