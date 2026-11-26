import { getPublicSiteOrigin } from '@/lib/article-public-url';

// Branded 1200x630 image shown when a page is shared and has no image of its
// own (link previews on WhatsApp, X, Facebook, LinkedIn, Slack and so on). The
// file lives in public/. The URL is built absolute here because link-preview
// crawlers need a full address, and this keeps it correct on every deployment.
export const DEFAULT_SHARE_IMAGE = {
  url: `${getPublicSiteOrigin()}/share-default.png`,
  width: 1200,
  height: 630,
  alt: 'Ground View News: independent commentary on global affairs',
};
