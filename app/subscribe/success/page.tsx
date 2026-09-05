import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Welcome to Ground View News',
  description: 'Your subscription is active. Thank you for supporting independent journalism.',
  robots: { index: false, follow: false },
};

const NAVY = '#0f1f3d';
const GOLD = '#d4a017';

export default function SubscribeSuccessPage() {
  return (
    <>
      <Navbar />

      <main className="bg-white">
        <section className="max-w-3xl mx-auto px-4 md:px-8 py-16 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-6"
            style={{ backgroundColor: GOLD, color: NAVY, fontWeight: 700, fontSize: 22 }}
            aria-hidden="true"
          >
            ✓
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            You&apos;re in. Thank you.
          </h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8">
            Your subscription is active. Ads are now hidden across the site, you&apos;ll receive our
            weekly digest every Monday, and new articles will be available to you 24 hours before
            free readers.
          </p>
          <p className="text-sm text-gray-500 leading-relaxed mb-10">
            A receipt has been emailed to you by Stripe. If you don&apos;t see ad-free reading take
            effect immediately, refresh the page once after signing in.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold rounded-sm text-white transition-colors"
              style={{ backgroundColor: NAVY }}
            >
              Back to the homepage
            </Link>
            <Link
              href="/journalists/login"
              className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold rounded-sm border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition-colors"
            >
              Sign in to manage your account
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
