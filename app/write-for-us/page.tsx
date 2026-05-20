import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const NAVY = '#0f1f3d';
const GOLD = '#D4AF37';

export const metadata: Metadata = {
  title: 'Write for Ground View News',
  description:
    'Join a growing community of writers covering global affairs, politics, business, sports, and more. Apply to write for Ground View News.',
  openGraph: {
    title: 'Write for Ground View News',
    description:
      'Join a growing community of writers covering global affairs, politics, business, sports, and more.',
  },
};

const COVERAGE_AREAS: { title: string; description: string }[] = [
  { title: 'World Politics', description: 'Elections, foreign policy, geopolitical analysis.' },
  { title: 'Business & Economy', description: 'Markets, trade, macroeconomic commentary.' },
  { title: 'Financial News & Banking', description: 'Central banks, regulation, fintech, capital markets.' },
  { title: 'Sports', description: 'Reporting and opinion across major leagues and global tournaments.' },
  { title: 'Africa & Diaspora', description: 'Stories from across Africa and its diaspora communities.' },
  { title: 'Science & Technology', description: 'Research, innovation, and the impact of new tech.' },
  { title: 'Culture & Society', description: 'Identity, the arts, social change.' },
  { title: 'Human Interest', description: 'Personal stories that illuminate the wider world.' },
  { title: 'Environment & Climate', description: 'Climate change, biodiversity, sustainability.' },
  { title: 'Health & Medicine', description: 'Public health, medical research, healthcare systems.' },
  { title: 'Law & Justice', description: 'Courts, legal reform, civil rights, accountability.' },
  { title: 'Education', description: 'Policy, access, teaching, and learning at every level.' },
  { title: 'Travel & Migration', description: 'Movement of people, places, borders, and belonging.' },
  { title: 'Opinion & Commentary', description: 'Sharp argument on the questions that matter most.' },
  { title: 'Other', description: 'Got a story that does not fit a box? Pitch it.' },
];

const HOW_IT_WORKS: { step: string; title: string; description: string }[] = [
  {
    step: '01',
    title: 'Apply',
    description: 'Fill in a short form. We review within 24 hours.',
  },
  {
    step: '02',
    title: 'Write',
    description: 'Draft your articles in our editor. Submit when ready.',
  },
  {
    step: '03',
    title: 'Publish',
    description: 'We review and approve. You get notified to click publish yourself.',
  },
];

export default function WriteForUsPage() {
  return (
    <>
      <Navbar />
      <main className="bg-white">
        {/* Hero */}
        <section style={{ backgroundColor: NAVY }} className="py-20 sm:py-24">
          <div className="max-w-4xl mx-auto px-4 md:px-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400 mb-4">
              Writers Programme
            </p>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Write for Ground View News
            </h1>
            <p className="mt-6 text-base sm:text-lg text-gray-300 leading-relaxed max-w-2xl mx-auto">
              Join a growing community of writers covering global affairs, politics, business,
              sports, and more. Your voice. Your perspective. Your audience.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
              <Link
                href="/write-for-us/apply"
                className="inline-flex items-center px-6 py-3 text-sm font-semibold rounded-sm text-[#1a1a1a] shadow-sm transition-colors hover:opacity-95"
                style={{ backgroundColor: GOLD }}
              >
                Apply to Write
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center px-6 py-3 text-sm font-semibold rounded-sm border border-white/30 text-gray-200 hover:bg-white/10 transition-colors"
              >
                How it works
              </a>
            </div>
          </div>
        </section>

        {/* What we cover */}
        <section className="py-16 sm:py-20 border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 md:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700 mb-3">
                What we cover
              </p>
              <h2
                className="text-3xl sm:text-4xl font-bold text-gray-900"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                Stories that matter to the world
              </h2>
            </div>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {COVERAGE_AREAS.map((area) => (
                <div
                  key={area.title}
                  className="border border-gray-200 bg-white rounded-sm px-5 py-6 hover:border-gray-400 transition-colors"
                >
                  <h3
                    className="text-base font-bold text-gray-900 mb-2"
                    style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                  >
                    {area.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{area.description}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-gray-600">
              And more — if it matters to the world, it matters to us.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-16 sm:py-20 bg-gray-50 border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 md:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700 mb-3">
                How it works
              </p>
              <h2
                className="text-3xl sm:text-4xl font-bold text-gray-900"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                Three steps to publishing
              </h2>
            </div>
            <ol className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              {HOW_IT_WORKS.map((item) => (
                <li
                  key={item.step}
                  className="bg-white border border-gray-200 rounded-sm p-6 flex flex-col"
                >
                  <span
                    className="text-3xl font-bold mb-3"
                    style={{ color: GOLD, fontFamily: 'Playfair Display, Georgia, serif' }}
                  >
                    {item.step}
                  </span>
                  <h3
                    className="text-xl font-bold text-gray-900 mb-2"
                    style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Our community */}
        <section className="py-16 sm:py-20 border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-4 md:px-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700 mb-3">
              Our community
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold text-gray-900 mb-5"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Join the conversation
            </h2>
            <p className="text-base text-gray-700 leading-relaxed">
              Ground View News is building a global community of independent writers covering
              stories that matter. Join us and make your voice heard.
            </p>
          </div>
        </section>

        {/* Closing CTA */}
        <section style={{ backgroundColor: NAVY }} className="py-14">
          <div className="max-w-3xl mx-auto px-4 md:px-8 text-center">
            <h2
              className="text-2xl sm:text-3xl font-bold text-white"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Ready to write for us?
            </h2>
            <p className="mt-3 text-gray-300 text-sm sm:text-base">
              Fill in a short application. We will be in touch within 24 hours.
            </p>
            <Link
              href="/write-for-us/apply"
              className="mt-6 inline-flex items-center px-6 py-3 text-sm font-semibold rounded-sm text-[#1a1a1a] shadow-sm transition-colors hover:opacity-95"
              style={{ backgroundColor: GOLD }}
            >
              Apply to Write
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
