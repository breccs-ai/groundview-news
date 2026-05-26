import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SubscribeCheckoutButton from '@/components/SubscribeCheckoutButton';

export const metadata: Metadata = {
  title: 'Subscribe | Ground View News',
  description:
    'Support independent global commentary. Subscribe to Ground View News from £4.99/month — remove ads, get early access, and fund the writers behind every story.',
};

const benefits: string[] = [
  'No advertisements while reading',
  'Weekly newsletter digest delivered to your inbox',
  'Early access to new articles (24 hours before free readers)',
  'Support independent global journalism',
  'Support the writers behind every story',
];

const NAVY = '#0f1f3d';
const GOLD = '#d4a017';

export default function SubscribePage() {
  return (
    <>
      <Navbar />

      <main className="bg-white">
        {/* Hero */}
        <section className="border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-4 md:px-8 pt-14 pb-10 text-center">
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-4"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Support Ground View News
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 leading-relaxed font-light">
              Independent. Unapologetic. Yours to support.
            </p>
          </div>
        </section>

        {/* Pricing cards */}
        <section className="bg-white">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {/* Monthly */}
              <article
                className="relative rounded-sm border border-gray-200 p-6 sm:p-8 bg-white flex flex-col"
                style={{ minHeight: '320px' }}
              >
                <header className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Monthly
                  </p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span
                      className="text-4xl font-bold text-gray-900"
                      style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                    >
                      £4.99
                    </span>
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">Billed monthly, cancel anytime.</p>
                </header>
                <div className="mt-auto pt-6">
                  <SubscribeCheckoutButton
                    plan="monthly"
                    label="Subscribe — £4.99/month"
                    className="w-full inline-flex items-center justify-center px-5 py-3 text-sm font-semibold rounded-sm transition-colors border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white disabled:opacity-60"
                  />
                </div>
              </article>

              {/* Annual */}
              <article
                className="relative rounded-sm border-2 p-6 sm:p-8 bg-white flex flex-col"
                style={{ borderColor: NAVY, minHeight: '320px' }}
              >
                {/* Best value badge */}
                <div
                  className="absolute -top-3 left-6 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest rounded-sm"
                  style={{ backgroundColor: GOLD, color: NAVY }}
                >
                  Best value
                </div>

                <header className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: NAVY }}>
                    Annual
                  </p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span
                      className="text-4xl font-bold text-gray-900"
                      style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                    >
                      £39
                    </span>
                    <span className="text-sm text-gray-500">/year</span>
                    <span
                      className="ml-2 text-xs font-semibold"
                      style={{ color: GOLD }}
                    >
                      save 35%
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">Billed once per year.</p>
                </header>
                <div className="mt-auto pt-6">
                  <SubscribeCheckoutButton
                    plan="annual"
                    label="Subscribe — £39/year"
                    className="w-full inline-flex items-center justify-center px-5 py-3 text-sm font-semibold rounded-sm transition-colors text-white hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: NAVY }}
                  />
                </div>
              </article>
            </div>

            {/* Benefits */}
            <div className="mt-14">
              <h2
                className="text-xl font-bold text-gray-900 mb-5"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                What your subscription includes
              </h2>
              <ul className="space-y-3">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-gray-800">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: GOLD, color: NAVY, fontWeight: 700 }}
                    >
                      ✓
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Trust statement */}
            <div className="mt-12 pt-8 border-t border-gray-100">
              <p className="text-xs text-gray-500 leading-relaxed max-w-2xl">
                Ground View News is published by Breccs Private Limited, registered in the United
                Kingdom. Your subscription directly funds our writers and editorial operations.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
