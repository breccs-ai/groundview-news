import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact | Ground View News',
  description:
    'Get in touch with Ground View News — send us a message, a story tip, or a question for our editorial team.',
  alternates: { canonical: '/contact' },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
