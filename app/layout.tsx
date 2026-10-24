import './fonts.css';
import './globals.css';
import type { Metadata } from 'next';
import CookieConsent from '@/components/CookieConsent';
import { SubscriptionProvider } from '@/components/SubscriptionProvider';

export const metadata: Metadata = {
  metadataBase: new URL('https://groundviewnews.com'),
  title: 'Ground View News: Independent Global Commentary',
  description:
    'Ground View News publishes independent commentary on global affairs, human rights, world politics, and the global economy.',
  openGraph: {
    siteName: 'Ground View News',
    type: 'website',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SubscriptionProvider>
          {children}
          <CookieConsent />
        </SubscriptionProvider>
      </body>
    </html>
  );
}
