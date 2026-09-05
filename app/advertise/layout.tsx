import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Advertise | Ground View News',
  description:
    'Reach readers across Africa, the diaspora, and global affairs coverage. Advertising packages on Ground View News, from 7 to 90 days.',
  alternates: { canonical: '/advertise' },
};

export default function AdvertiseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
