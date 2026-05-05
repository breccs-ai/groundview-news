import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import NewsletterSignup from '@/components/NewsletterSignup';
import { Globe, FileText, Users, Award } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About | Ground View News',
  description:
    'Ground View News publishes independent commentary on global affairs: Africa, human rights, world politics, and the global economy.',
};

const values = [
  {
    icon: Globe,
    title: 'Global Perspective',
    body: 'We report from and for the world, with particular focus on Africa, the African diaspora, and the communities whose stories are underrepresented in mainstream media.',
  },
  {
    icon: FileText,
    title: 'Editorial Independence',
    body: 'No sponsored editorial. No government funding. No agenda beyond accuracy and rigour. Our writers answer to the evidence, not to advertisers or political patrons.',
  },
  {
    icon: Users,
    title: 'Ground-Up Journalism',
    body: 'We believe the most important stories start at the human level: the cost borne by ordinary people, the patterns only visible from the ground, the narratives that top-down coverage misses.',
  },
  {
    icon: Award,
    title: 'Standards of Accuracy',
    body: 'Every article is reviewed before publication. We correct our errors promptly and prominently. We do not publish anonymous sources without editorial approval.',
  },
];

export default function AboutPage() {
  return (
    <>
      <Navbar />

      <main className="bg-white">
        {/* Page header */}
        <div style={{ backgroundColor: '#0f1f3d' }} className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">
              About Us
            </p>
            <h1
              className="text-4xl md:text-5xl font-bold text-white leading-tight"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Independent analysis.<br />No agenda. No press releases.
            </h1>
          </div>
        </div>

        {/* Mission statement */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <blockquote
            className="text-2xl md:text-3xl font-semibold text-gray-900 leading-relaxed text-center"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            &ldquo;Ground View News publishes independent commentary on global affairs. Our journalists write
            from the ground up, not from press releases, not from official narratives, but from the
            evidence, the pattern, and the human cost.&rdquo;
          </blockquote>
        </section>

        {/* Divider */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <hr className="border-gray-100" />
        </div>

        {/* What we cover */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
          <h2
            className="text-2xl font-bold text-gray-900 mb-6"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            What we cover
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-4">
            Ground View News covers global affairs with a particular focus on Africa, the African diaspora,
            human rights, world politics, and the international economy. We believe these subjects are
            too often reduced to wire-service summaries or covered only when they intersect with Western
            political interests.
          </p>
          <p className="text-gray-600 text-lg leading-relaxed mb-4">
            Our commentary is analytical and editorial in character. We do not aim to be a breaking-news
            service. We aim to be the publication that tells you what it means, and why it matters, and
            what comes next.
          </p>
          <p className="text-gray-600 text-lg leading-relaxed">
            We draw on writers who have direct experience of the regions and issues they cover, and we
            hold ourselves to the same standards of evidence we expect from the institutions we scrutinise.
          </p>
        </section>

        {/* Values */}
        <section className="bg-gray-50 py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2
              className="text-2xl font-bold text-gray-900 mb-10 text-center"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Our editorial values
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {values.map((v) => (
                <div key={v.title} className="bg-white p-6 border border-gray-100 rounded-sm">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-sm flex items-center justify-center"
                      style={{ backgroundColor: '#e8edf5' }}
                    >
                      <v.icon size={18} style={{ color: '#0f1f3d' }} />
                    </div>
                    <div>
                      <h3
                        className="text-base font-bold text-gray-900 mb-2"
                        style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                      >
                        {v.title}
                      </h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{v.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <NewsletterSignup />
      </main>

      <Footer />
    </>
  );
}
