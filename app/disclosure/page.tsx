import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Affiliate Disclosure | Ground View News',
  description:
    'How Ground View News uses affiliate links, and why our editorial independence is never affected by commercial relationships.',
  alternates: { canonical: '/disclosure' },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2
        className="text-xl font-bold text-gray-900 mb-4"
        style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
      >
        {title}
      </h2>
      <div className="space-y-4 text-gray-700 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default function DisclosurePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          {/* Header */}
          <div className="mb-12 pb-8 border-b border-gray-200">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-3">Legal</p>
            <h1
              className="text-4xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Affiliate Disclosure
            </h1>
            <p className="text-sm text-gray-500">Last updated: September 2026</p>
          </div>

          <Section title="Editorial Independence">
            <p>
              Ground View News is editorially independent. Our reporting and commentary are never
              influenced by affiliate or advertising relationships.
            </p>
          </Section>

          <Section title="How Affiliate Links Work">
            <p>
              Some articles contain links to products or services, including money transfer and
              financial platforms relevant to our readers. If you click one of these links and go
              on to use the service, we may earn a commission. This comes at no extra cost to you.
            </p>
          </Section>

          <Section title="Why We Include These Links">
            <p>
              We only link to services we consider genuinely relevant to the story or useful to our
              readers. Commercial relationships do not determine what we cover or how we cover it.
            </p>
          </Section>

          <Section title="Questions">
            <p>
              If you have questions about a specific link or partnership, contact us at{' '}
              <a
                href="mailto:info@groundviewnews.com"
                className="text-amber-700 hover:text-amber-900 underline"
              >
                info@groundviewnews.com
              </a>
              .
            </p>
          </Section>

          <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-6 text-xs text-gray-400">
            <Link href="/privacy-policy" className="hover:text-gray-700 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-gray-700 transition-colors">
              Terms &amp; Conditions
            </Link>
            <Link href="/disclaimer" className="hover:text-gray-700 transition-colors">
              Editorial Disclaimer
            </Link>
            <Link href="/editorial-policy" className="hover:text-gray-700 transition-colors">
              Editorial Policy
            </Link>
            <Link href="/" className="hover:text-gray-700 transition-colors">
              Return to homepage
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
