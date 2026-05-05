import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Editorial Policy — Ground View News',
  description:
    'Our standards for accuracy, sourcing, corrections, independence, and content moderation at Ground View News.',
};

const sections = [
  {
    title: 'Accuracy and Verification',
    body: [
      'All articles are reviewed by an editor before publication. Factual claims must be supported by named sources, official documents, or on-record reporting. Where claims cannot be independently verified, this is disclosed to the reader.',
      'We do not publish speculation presented as fact. We distinguish clearly between news reporting, analysis, and opinion.',
    ],
  },
  {
    title: 'Sourcing Standards',
    body: [
      'We do not use anonymous sources without explicit editorial approval. When anonymous sourcing is granted — in exceptional circumstances where the information is of genuine public interest and cannot be obtained on record — the editorial decision is documented internally.',
      'We require a minimum of two independent sources for contested factual claims. Single-source claims are clearly identified as such.',
    ],
  },
  {
    title: 'Corrections Policy',
    body: [
      'When we make a factual error, we correct it prominently and as quickly as possible. Corrections are published on the original article and, where the error was significant, noted in a subsequent editorial note.',
      'We do not delete or silently amend published articles. All substantive changes to published content are timestamped and explained.',
    ],
  },
  {
    title: 'Editorial Independence',
    body: [
      'Ground View News is editorially independent. Our editorial decisions are not influenced by advertisers, political organisations, governments, or financial backers.',
      'Advertising and sponsorship revenue does not affect the selection or presentation of editorial content. Advertorial content — paid content presented as editorial — is not produced or published by Ground View News.',
      'Writers are required to disclose any relevant personal, professional, or financial interests that could constitute a conflict of interest. Editors assess disclosed conflicts before commissioning or publishing.',
    ],
  },
  {
    title: 'No Sponsored Editorial',
    body: [
      'Ground View News does not publish sponsored content presented as editorial. All advertising is clearly labelled as advertising and is separated visually and contextually from editorial content.',
      'We do not accept payment for coverage, for positive or negative treatment of any subject, or for the placement or removal of editorial content.',
    ],
  },
  {
    title: 'Content Moderation',
    body: [
      'We do not publish content that incites violence, promotes discrimination on grounds of race, religion, gender, sexuality, nationality, or disability, or that constitutes harassment of individuals.',
      'Reader comments, where enabled, are moderated against these standards. We reserve the right to remove or decline to publish content that violates them without explanation.',
    ],
  },
  {
    title: 'Complaints and Appeals',
    body: [
      'Readers who believe an article contains a factual error, misrepresentation, or breach of this policy may submit a complaint via our contact page. We aim to respond to complaints within five working days.',
      'Where a complaint is upheld, we will publish a correction and notify the complainant. Where a complaint is not upheld, we will explain our reasoning.',
    ],
  },
];

export default function EditorialPolicyPage() {
  return (
    <>
      <Navbar />

      <main className="bg-white">
        {/* Header */}
        <div style={{ backgroundColor: '#0f1f3d' }} className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">
              Editorial Policy
            </p>
            <h1
              className="text-4xl md:text-5xl font-bold text-white leading-tight"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Our Standards
            </h1>
            <p className="mt-4 text-gray-400 text-base leading-relaxed max-w-xl">
              The principles by which Ground View News selects, verifies, and publishes journalism.
            </p>
          </div>
        </div>

        {/* Policy sections */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <div className="space-y-12">
            {sections.map((section, i) => (
              <div key={i} className="pb-12 border-b border-gray-100 last:border-0">
                <h2
                  className="text-xl font-bold text-gray-900 mb-4"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                >
                  {section.title}
                </h2>
                <div className="space-y-3">
                  {section.body.map((para, j) => (
                    <p key={j} className="text-gray-600 text-base leading-relaxed">
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Contact note */}
          <div className="mt-12 p-6 bg-gray-50 border border-gray-200 rounded-sm">
            <p className="text-sm text-gray-700 leading-relaxed">
              This policy was last reviewed in May 2025. Questions about editorial standards should be
              directed to our editorial team via the{' '}
              <a href="/contact" className="text-blue-800 underline hover:no-underline">
                contact page
              </a>
              .
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
