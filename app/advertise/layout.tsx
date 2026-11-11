import type { Metadata } from 'next';
import { getMonthlyPriceGbp } from '@/lib/advertiser/pricing';

export const metadata: Metadata = {
  title: 'Advertise | Ground View News',
  description: `Reach readers across Africa, the diaspora, and global affairs coverage. Advertising plans on Ground View News, from £${getMonthlyPriceGbp('basic')} per month.`,
  alternates: { canonical: '/advertise' },
};

export default function AdvertiseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
