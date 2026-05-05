import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Mail, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Editorial Disclaimer — Ground View News',
  description:
    'Ground View News is a commentary and opinion publication. Read our editorial disclaimer, corrections policy, and source standards.',
};

export default function DisclaimerPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          {/* Header */}
          <div className="mb-12 pb-8 border-b border-gray-200">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-3">
              Editorial
            </p>
            <h1
              className="text-4xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Editorial Disclaimer
            </h1>
            <p className="text-sm text-gray-500">
              Last updated: May 2026
            </p>
          </div>

          {/* Key statement callout */}
          <div
            className="mb-12 p-6 rounded-sm border-l-4 border-amber-500"
            style={{ backgroundColor: '#fffbeb' }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  Ground View News is a commentary and opinion publication.
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Articles published on this site represent the independent analytical judgement and
                  opinion of individual authors. They are not verified news reports, and they should
                  not be read as statements of established fact. Readers are encouraged to consult
                  primary sources and exercise their own judgement before acting on any information
                  published here.
                </p>
              </div>
            </div>
          </div>

          {/* Section 1 */}
          <section className="mb-10">
            <h2
              className="text-xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              What Kind of Publication Are We?
            </h2>
            <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
              <p>
                Ground View News publishes <strong>independent commentary and opinion</strong> on
                global affairs, with a particular focus on Africa, the African diaspora, human rights,
                world politics, and the global economy.
              </p>
              <p>
                We are <strong>not</strong> a wire service, a breaking-news publisher, or a
                fact-checking organisation. Our writers bring expertise, perspective, and analysis to
                events and issues — they are not neutral reporters of record, and their articles are
                not intended to be read as such.
              </p>
              <p>
                Ground View News believes that commentary and opinion — clearly labelled — serves
                a vital public function. It helps readers understand context, challenge assumptions,
                and engage with global events from perspectives that are often underrepresented in
                mainstream media. We are committed to publishing commentary that is well-reasoned,
                well-sourced where sources are available, and honest about the distinction between
                analysis and verified fact.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="mb-10">
            <h2
              className="text-xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Authors&rsquo; Views Are Their Own
            </h2>
            <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
              <p>
                Every article published on Ground View News carries a byline. The views expressed in
                any article — including commentary, opinion, and analysis — are those of the named
                author. They do not necessarily represent the views of Ground View News as a
                publication, its editorial board, or any other contributor.
              </p>
              <p>
                Where multiple perspectives on a topic exist, Ground View News may publish
                commentary from writers who hold different or opposing views. Publication of an
                article does not constitute institutional endorsement of the positions expressed
                within it.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-10">
            <h2
              className="text-xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Sources and Citations
            </h2>
            <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
              <p>
                Where articles make reference to external events, data, reports, or statements, authors
                are expected to cite their sources within the article. Cited sources are linked or
                identified by name, publication, and date where possible.
              </p>
              <p>
                The inclusion of a source citation indicates that the author has referenced that
                source in forming their analysis. It does not constitute Ground View News&rsquo;s
                independent verification of the cited source&rsquo;s accuracy or methodology.
              </p>
              <p>
                Readers who wish to verify claims made in any article are encouraged to consult the
                cited sources directly and to seek out additional primary sources independently.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-10">
            <h2
              className="text-xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Accuracy and Our Limitations
            </h2>
            <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
              <p>
                Ground View News strives for accuracy in all content it publishes. Our editorial
                process includes reviewing articles before publication for clarity, sourcing, and
                factual plausibility. However, we operate as an independent publication with limited
                resources and cannot independently verify every claim made in every piece.
              </p>
              <p>
                <strong>
                  Ground View News does not warrant that all content published on this site is
                  complete, current, accurate, or free from error.
                </strong>{' '}
                Information can become outdated after publication as events develop. Analysis
                written at one moment in time may be overtaken by subsequent facts.
              </p>
              <p>
                Readers should <strong>not</strong> rely on content published on this site as the
                sole basis for any legal, financial, medical, professional, or personal decision.
                Nothing on this site constitutes professional advice of any kind.
              </p>
            </div>
          </section>

          {/* Section 5 — No Liability */}
          <section className="mb-10">
            <h2
              className="text-xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Limitation of Liability
            </h2>
            <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
              <p>
                Ground View News and its authors shall not be liable for any loss, damage, or
                consequence arising from reliance on any content, opinion, or analysis published on
                this site. This includes but is not limited to financial loss, reputational damage,
                or harm arising from decisions made on the basis of published commentary.
              </p>
              <p>
                For our full limitation of liability provisions, see our{' '}
                <Link href="/terms" className="text-amber-700 hover:text-amber-900 underline">
                  Terms &amp; Conditions
                </Link>
                .
              </p>
            </div>
          </section>

          {/* Section 6 — Corrections */}
          <section className="mb-10">
            <div
              className="p-6 rounded-sm border border-green-200"
              style={{ backgroundColor: '#f0fdf4' }}
            >
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                <h2
                  className="text-xl font-bold text-gray-900"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                >
                  Corrections Policy
                </h2>
              </div>
              <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
                <p>
                  We take accuracy seriously. When a factual error in a published article is
                  identified and verified, Ground View News will:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Review the reported error within <strong>48 hours</strong> of receipt of a
                    correction request.
                  </li>
                  <li>
                    If the error is confirmed, correct the article and append a visible correction
                    notice stating what was changed and when.
                  </li>
                  <li>
                    Where an error is material — meaning it significantly changes the meaning,
                    fairness, or impact of an article — we will publish a standalone correction
                    notice.
                  </li>
                  <li>
                    We do not silently alter articles after publication. All substantive post-publication
                    changes are noted with a correction notice.
                  </li>
                </ul>
                <div className="mt-4 flex items-center gap-3 pt-4 border-t border-green-200">
                  <Mail size={16} className="text-green-700 flex-shrink-0" />
                  <p>
                    To report an error, email{' '}
                    <a
                      href="mailto:editorial@groundviewnews.com"
                      className="text-amber-700 hover:text-amber-900 underline font-medium"
                    >
                      editorial@groundviewnews.com
                    </a>{' '}
                    with the article URL, the specific passage you believe is in error, and any
                    supporting evidence. We will acknowledge receipt and provide a response.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 7 — Editorial Policy Link */}
          <section className="mb-10">
            <h2
              className="text-xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Editorial Standards
            </h2>
            <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
              <p>
                This disclaimer should be read alongside our full{' '}
                <Link
                  href="/editorial-policy"
                  className="text-amber-700 hover:text-amber-900 underline"
                >
                  Editorial Policy
                </Link>
                , which sets out the standards we expect of all contributors, our approach to
                sourcing and attribution, how we handle conflicts of interest, and the process for
                submitting content.
              </p>
              <p>
                Ground View News does not accept payment for editorial coverage. Advertiser
                relationships do not influence our editorial decisions. All advertising content is
                clearly distinguished from editorial content.
              </p>
            </div>
          </section>

          {/* Quick-reference card */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/editorial-policy"
              className="group flex flex-col gap-2 p-4 border border-gray-200 rounded-sm hover:border-amber-400 transition-colors"
            >
              <FileText size={18} className="text-amber-600" />
              <span className="text-sm font-semibold text-gray-900 group-hover:text-amber-700 transition-colors">
                Editorial Policy
              </span>
              <span className="text-xs text-gray-500">Contributor standards and sourcing rules</span>
            </Link>
            <Link
              href="/terms"
              className="group flex flex-col gap-2 p-4 border border-gray-200 rounded-sm hover:border-amber-400 transition-colors"
            >
              <FileText size={18} className="text-amber-600" />
              <span className="text-sm font-semibold text-gray-900 group-hover:text-amber-700 transition-colors">
                Terms &amp; Conditions
              </span>
              <span className="text-xs text-gray-500">Site use, IP, and legal terms</span>
            </Link>
            <Link
              href="/privacy-policy"
              className="group flex flex-col gap-2 p-4 border border-gray-200 rounded-sm hover:border-amber-400 transition-colors"
            >
              <FileText size={18} className="text-amber-600" />
              <span className="text-sm font-semibold text-gray-900 group-hover:text-amber-700 transition-colors">
                Privacy Policy
              </span>
              <span className="text-xs text-gray-500">GDPR, data collection, and your rights</span>
            </Link>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200 flex flex-wrap gap-6 text-xs text-gray-400">
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
