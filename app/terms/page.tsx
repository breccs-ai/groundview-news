import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Terms & Conditions | Ground View News',
  description:
    'Terms and conditions governing your use of the Ground View News website and publication.',
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

export default function TermsPage() {
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
              Terms &amp; Conditions
            </h1>
            <p className="text-sm text-gray-500">
              Last updated: May 2026. Effective date: May 2026.
            </p>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed mb-10">
            Please read these Terms &amp; Conditions carefully before using the Ground View News
            website at <strong>groundviewnews.com</strong> (the &ldquo;Site&rdquo;). By accessing or
            using the Site in any way, you agree to be bound by these Terms. If you do not agree,
            please do not use the Site. These Terms are governed by the laws of the Republic of
            Ireland.
          </p>

          <Section title="1. About Ground View News">
            <p>
              Ground View News (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is an
              independent digital news commentary publication operated from the Republic of Ireland.
              The Site publishes commentary, opinion, and analysis on global affairs, including
              human rights, world politics, and the global economy, without geographic or political bias.
            </p>
            <p>
              Ground View News is a <strong>commentary and opinion publication</strong>. It is not
              a news wire service, a fact-checking body, or a verified-news publisher. Content
              published on the Site reflects the editorial perspectives and analytical judgement of
              individual authors. For our full editorial framework, please read our{' '}
              <Link href="/disclaimer" className="text-amber-700 hover:text-amber-900 underline">
                Editorial Disclaimer
              </Link>{' '}
              and{' '}
              <Link
                href="/editorial-policy"
                className="text-amber-700 hover:text-amber-900 underline"
              >
                Editorial Policy
              </Link>
              .
            </p>
          </Section>

          <Section title="2. Acceptance of Terms">
            <p>
              By accessing or using the Site, including reading articles, subscribing to our
              newsletter, submitting a contact form, or contributing content, you confirm that you
              are at least 16 years old and that you accept these Terms &amp; Conditions in full.
            </p>
            <p>
              We reserve the right to amend these Terms at any time by posting an updated version
              on this page. Changes take effect immediately upon publication. Your continued use of
              the Site after changes are posted constitutes your acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="3. Nature of the Service: Editorial Disclaimer">
            <p>
              Ground View News publishes <strong>commentary, opinion, and analysis</strong>.
              Articles on the Site represent the views and analytical judgements of the individual
              authors who wrote them. They do not represent the institutional position of Ground
              View News as an organisation, and they do not constitute verified, objective news
              reporting.
            </p>
            <p>
              Ground View News strives for accuracy and fairness in all content it publishes. Where
              articles reference external events, sources are cited where available. However,{' '}
              <strong>
                we do not warrant that all content published on the Site is complete, current,
                accurate, or free from error.
              </strong>
            </p>
            <p>
              When factual errors are brought to our attention, we review them promptly and publish
              corrections with a correction notice. Errors may be reported to{' '}
              <a
                href="mailto:info@groundviewnews.com"
                className="text-amber-700 hover:text-amber-900 underline"
              >
                info@groundviewnews.com
              </a>
              .
            </p>
            <p>
              Readers are encouraged to verify information independently before acting on any
              content published on the Site.
            </p>
          </Section>

          <Section title="4. No Professional Advice">
            <p>
              Nothing on the Site constitutes legal, financial, medical, investment, tax, or any
              other form of professional or regulated advice. All content is provided for
              informational, educational, and commentary purposes only. You should always seek
              qualified, independent professional advice before making decisions based on
              information you have read on the Site.
            </p>
            <p>
              Ground View News and its authors expressly disclaim any liability arising from reliance
              on content published on the Site for any professional or personal decision-making
              purpose.
            </p>
          </Section>

          <Section title="5. Intellectual Property">
            <p>
              All content published on the Site, including articles, editorials, commentary,
              analysis, headlines, photographs, graphics, illustrations, logos, and the site&rsquo;s
              overall design and layout, is the property of Ground View News or its contributing
              authors and is protected by copyright law, including the Copyright and Related Rights
              Act 2000 (Ireland) and applicable international copyright conventions.
            </p>
            <p>You may, for personal non-commercial use:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Read and share links to articles published on the Site.</li>
              <li>Print individual articles for personal reference.</li>
              <li>
                Quote brief excerpts with clear attribution to Ground View News and a link to the
                original article.
              </li>
            </ul>
            <p>You may <strong>not</strong>:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Reproduce, republish, broadcast, or distribute our content in full or in substantial
                part without prior written permission.
              </li>
              <li>
                Use our content for commercial purposes, including in AI training datasets,
                content aggregators, or machine learning systems, without a separate licensing
                agreement.
              </li>
              <li>
                Scrape, crawl, or systematically extract content from the Site by automated means.
              </li>
              <li>
                Remove, alter, or obscure any copyright notices, author credits, or proprietary
                markings.
              </li>
              <li>
                Republish our content in a manner that suggests endorsement or affiliation where
                none exists.
              </li>
            </ul>
            <p>
              To request syndication, republication, or licensing rights, please contact{' '}
              <a
                href="mailto:info@groundviewnews.com"
                className="text-amber-700 hover:text-amber-900 underline"
              >
                info@groundviewnews.com
              </a>
              .
            </p>
          </Section>

          <Section title="6. User-Submitted Content">
            <p>
              If you submit an article pitch, letter to the editor, or other content to Ground View
              News, you grant us a non-exclusive, royalty-free, worldwide, transferable licence to
              publish, edit, adapt, translate, and distribute that content in connection with the
              Site and our editorial operations, in any media format now known or later developed.
            </p>
            <p>By submitting content, you warrant that:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>The content is your original work, or you have the right to submit it.</li>
              <li>
                It does not infringe the intellectual property rights, privacy rights, or any other
                rights of any third party.
              </li>
              <li>
                It is not defamatory, obscene, harassing, threatening, or unlawful under the laws of
                Ireland, the EU, or the UK.
              </li>
              <li>It does not contain malicious code, viruses, spam, or unsolicited advertising.</li>
            </ul>
            <p>
              We reserve the right to decline, edit, or remove any submitted content at our sole
              discretion without obligation to give reasons.
            </p>
          </Section>

          <Section title="7. Newsletter Subscriptions">
            <p>
              By subscribing to the Ground View News newsletter, you consent to receiving periodic
              editorial emails from us. You may unsubscribe at any time by clicking the unsubscribe
              link in any email. We will not use your email address for any purpose beyond delivering
              the newsletter, as described in our{' '}
              <Link href="/privacy-policy" className="text-amber-700 hover:text-amber-900 underline">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>

          <Section title="8. Advertising and Sponsored Content">
            <p>
              The Site displays third-party advertising and may, from time to time, publish sponsored
              content. The following rules apply:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                All advertising and sponsored content is clearly labelled as
                &ldquo;Advertisement&rdquo;, &ldquo;Sponsored&rdquo;, or &ldquo;Paid
                Partnership&rdquo;, and is visually distinct from editorial content.
              </li>
              <li>
                Ground View News is not responsible for the accuracy, legality, or appropriateness
                of claims made in advertiser content. Advertising is provided by third parties and
                is subject to those parties&rsquo; own terms and privacy policies.
              </li>
              <li>
                The presence of advertising on the Site does not constitute editorial endorsement of
                the advertised product, service, or organisation.
              </li>
              <li>
                Third-party ad providers may use cookies and tracking technologies subject to your
                cookie consent preferences. See our{' '}
                <Link
                  href="/privacy-policy#cookies"
                  className="text-amber-700 hover:text-amber-900 underline"
                >
                  Cookie Policy
                </Link>{' '}
                for details.
              </li>
            </ul>
            <p>
              Advertisers wishing to place advertising on the Site should contact{' '}
              <Link href="/advertise" className="text-amber-700 hover:text-amber-900 underline">
                our advertising team
              </Link>
              .
            </p>
          </Section>

          <Section title="9. Acceptable Use">
            <p>You agree not to use the Site to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Violate any applicable local, national, or international law or regulation,
                including Irish law, EU law, and applicable UK law.
              </li>
              <li>
                Engage in conduct that is harmful, threatening, abusive, harassing, discriminatory,
                or inflammatory.
              </li>
              <li>
                Attempt to gain unauthorised access to any part of the Site, our servers, databases,
                or connected systems.
              </li>
              <li>
                Interfere with, disrupt, or degrade the performance or availability of the Site.
              </li>
              <li>
                Transmit unsolicited communications (spam) or distribute malicious software.
              </li>
              <li>
                Impersonate Ground View News, its editors, authors, or any other person or
                organisation.
              </li>
              <li>
                Use automated tools to scrape, index, or harvest content from the Site without
                express written permission.
              </li>
            </ul>
          </Section>

          <Section title="10. Third-Party Links and External Content">
            <p>
              Articles on the Site may contain links to third-party websites, reports, and resources
              for reference, context, or source citation. These links are provided for convenience
              only. We do not control, endorse, or accept responsibility for the content,
              availability, accuracy, or privacy practices of linked third-party sites.
            </p>
            <p>
              Linking to a third-party source does not constitute endorsement of that
              source&rsquo;s views, methodology, or content beyond the specific passage cited.
            </p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>
              To the fullest extent permitted by Irish and EU law, Ground View News, its editors,
              contributors, directors, and affiliates shall not be liable for any direct, indirect,
              incidental, special, consequential, or exemplary damages arising from:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your use of, or inability to use, the Site or any content on it.</li>
              <li>Any reliance placed on information, opinion, or analysis published on the Site.</li>
              <li>
                Any errors, omissions, inaccuracies, or outdated information in published content.
              </li>
              <li>
                Unauthorised access to or alteration of data transmitted by or to you via the Site.
              </li>
              <li>
                Any interruption, suspension, or permanent termination of the Site or any part of it.
              </li>
            </ul>
            <p>
              Nothing in these Terms limits our liability for death or personal injury caused by our
              negligence, for fraud or fraudulent misrepresentation, or for any other liability that
              cannot be excluded or limited under Irish or EU law.
            </p>
          </Section>

          <Section title="12. Disclaimer of Warranties">
            <p>
              The Site and all content are provided on an &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo; basis without any warranty of any kind, whether express, implied, or
              statutory. We do not warrant that the Site will be uninterrupted, error-free, secure,
              or free of viruses or other harmful components.
            </p>
          </Section>

          <Section title="13. Indemnification">
            <p>
              You agree to indemnify, defend, and hold harmless Ground View News, its editors,
              contributors, officers, and agents from and against any claims, actions, damages,
              losses, liabilities, costs, and expenses (including reasonable legal fees) arising
              from your use of the Site in breach of these Terms or in violation of any applicable
              law.
            </p>
          </Section>

          <Section title="14. Governing Law and Jurisdiction">
            <p>
              These Terms &amp; Conditions are governed by and construed in accordance with the laws
              of the <strong>Republic of Ireland</strong>. Any dispute arising out of or in connection
              with these Terms shall be subject to the exclusive jurisdiction of the courts of
              Ireland, without prejudice to your rights as a consumer under the law of your country
              of residence where applicable.
            </p>
          </Section>

          <Section title="15. Severability">
            <p>
              If any provision of these Terms is found to be unlawful, void, or unenforceable by a
              court of competent jurisdiction, that provision shall be severed from the remaining
              Terms. The remaining Terms shall continue in full force and effect and shall be
              construed as if the severed provision had never existed.
            </p>
          </Section>

          <Section title="16. Contact">
            <p>
              For questions or concerns about these Terms &amp; Conditions:
            </p>
            <p>
              <strong>Ground View News</strong>
              <br />
              Email:{' '}
              <a
                href="mailto:legal@groundviewnews.com"
                className="text-amber-700 hover:text-amber-900 underline"
              >
                legal@groundviewnews.com
              </a>
              <br />
              Website:{' '}
              <Link href="/contact" className="text-amber-700 hover:text-amber-900 underline">
                groundviewnews.com/contact
              </Link>
            </p>
          </Section>

          <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-6 text-xs text-gray-400">
            <Link href="/privacy-policy" className="hover:text-gray-700 transition-colors">
              Privacy Policy
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
