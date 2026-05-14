import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Terms of Use | Ground View News',
  description: 'Terms and conditions governing use of the Ground View News website.',
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

export default function TermsOfUsePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          {/* Header */}
          <div className="mb-12 pb-8 border-b border-gray-200">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-3">
              Legal
            </p>
            <h1
              className="text-4xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Terms of Use
            </h1>
            <p className="text-sm text-gray-500">
              Last updated: 5 May 2026. Effective date: 5 May 2026.
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-700 leading-relaxed mb-10">
              Please read these Terms of Use carefully before using the Ground View News website
              located at <strong>groundviewnews.com</strong> (the "Website"). By accessing or using
              the Website, you agree to be bound by these Terms. If you do not agree, please do not
              use the Website.
            </p>

            <Section title="1. About Ground View News">
              <p>
                Ground View News ("we", "us", "our") is an independent digital publication providing
                commentary, analysis, and reporting on global affairs, Africa, the African diaspora,
                human rights, world politics, and the global economy. We operate the Website as a
                journalistic and editorial platform.
              </p>
            </Section>

            <Section title="2. Acceptance of Terms">
              <p>
                By accessing or using the Website in any way, including reading articles, subscribing
                to our newsletter, submitting a contact form, or contributing content, you confirm
                that you are at least 16 years old and that you accept and agree to comply with these
                Terms of Use in full.
              </p>
              <p>
                We reserve the right to modify these Terms at any time. Changes take effect
                immediately upon posting. Your continued use of the Website after changes constitutes
                your acceptance of the revised Terms.
              </p>
            </Section>

            <Section title="3. Intellectual Property">
              <p>
                All content on this Website, including articles, editorials, commentary, headlines,
                photographs, graphics, logos, and the overall design, is the property of Ground View
                News or its contributing authors and is protected by copyright law.
              </p>
              <p>
                You may read, share links to, and print individual articles for personal,
                non-commercial use only. You may not:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Reproduce, republish, or distribute our content without express written permission.</li>
                <li>Scrape, crawl, or systematically extract content from the Website.</li>
                <li>Use our content for commercial purposes without a licensing agreement.</li>
                <li>
                  Remove or alter any copyright notices, author attributions, or proprietary
                  designations.
                </li>
              </ul>
              <p>
                To request syndication or republication rights, contact us at{' '}
                <a
                  href="mailto:info@groundviewnews.com"
                  className="text-amber-700 hover:text-amber-900 underline"
                >
                  info@groundviewnews.com
                </a>
                .
              </p>
            </Section>

            <Section title="4. Editorial Independence and Opinion Content">
              <p>
                Ground View News publishes opinion pieces, commentary, and analysis that reflect the
                views of individual authors. Such content does not necessarily represent the
                institutional views of Ground View News.
              </p>
              <p>
                All editorial content is produced in accordance with our{' '}
                <Link
                  href="/editorial-policy"
                  className="text-amber-700 hover:text-amber-900 underline"
                >
                  Editorial Policy
                </Link>
                . We strive for accuracy and fairness, but we do not warrant that all published
                information is complete, accurate, or current. Readers should verify information
                independently before relying on it.
              </p>
            </Section>

            <Section title="5. No Professional Advice">
              <p>
                Nothing on this Website constitutes legal, financial, medical, political, or any other
                form of professional advice. Content is provided for informational and commentary
                purposes only. You should always seek qualified professional advice before acting on
                any information you read here.
              </p>
            </Section>

            <Section title="6. User-Submitted Content">
              <p>
                If you submit an article pitch, letter, or other content to Ground View News, you
                grant us a non-exclusive, royalty-free, worldwide licence to publish, edit, adapt, and
                distribute that content in connection with the Website and our editorial operations.
              </p>
              <p>You warrant that any content you submit:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Is your original work or you have the right to submit it.</li>
                <li>Does not infringe the intellectual property rights of any third party.</li>
                <li>Is not defamatory, obscene, harassing, or otherwise unlawful.</li>
                <li>Does not contain viruses, malicious code, or spam.</li>
              </ul>
              <p>
                We reserve the right to reject, edit, or remove any submitted content at our
                discretion.
              </p>
            </Section>

            <Section title="7. Newsletter and Email Communications">
              <p>
                By subscribing to our newsletter, you consent to receiving periodic editorial emails
                from Ground View News. You may unsubscribe at any time by clicking the unsubscribe
                link in any email or by contacting us directly. We will not use your email address for
                purposes other than those described in our{' '}
                <Link
                  href="/privacy-policy"
                  className="text-amber-700 hover:text-amber-900 underline"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </Section>

            <Section title="8. Acceptable Use">
              <p>You agree not to use the Website to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Violate any applicable local, national, or international law or regulation.</li>
                <li>
                  Engage in any conduct that is harmful, threatening, abusive, harassing, or
                  discriminatory.
                </li>
                <li>
                  Attempt to gain unauthorised access to any part of the Website, its servers, or any
                  connected systems.
                </li>
                <li>
                  Interfere with the operation of the Website or disrupt other users' experience.
                </li>
                <li>
                  Transmit unsolicited communications, spam, or malicious software.
                </li>
                <li>
                  Impersonate Ground View News, its staff, or any other person or entity.
                </li>
              </ul>
            </Section>

            <Section title="9. Third-Party Links">
              <p>
                The Website may contain links to third-party websites for reference or context. These
                links are provided for your convenience only. We have no control over the content or
                availability of those sites and accept no responsibility or liability for them.
                Linking to a third-party site does not constitute endorsement of that site's views or
                content.
              </p>
            </Section>

            <Section title="10. Limitation of Liability">
              <p>
                To the maximum extent permitted by applicable law, Ground View News and its editors,
                contributors, and affiliates shall not be liable for any direct, indirect, incidental,
                special, or consequential damages arising from:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Your use of, or inability to use, the Website or its content.</li>
                <li>Any errors, omissions, or inaccuracies in published content.</li>
                <li>Unauthorised access to or alteration of your data.</li>
                <li>Any interruption, suspension, or termination of the Website.</li>
              </ul>
              <p>
                Nothing in these Terms limits our liability for death or personal injury caused by our
                negligence, or for fraud or fraudulent misrepresentation.
              </p>
            </Section>

            <Section title="11. Disclaimer of Warranties">
              <p>
                The Website and all content are provided on an "as is" and "as available" basis
                without warranties of any kind, express or implied. We do not warrant that the Website
                will be uninterrupted, error-free, or free of viruses or other harmful components.
              </p>
            </Section>

            <Section title="12. Indemnification">
              <p>
                You agree to indemnify, defend, and hold harmless Ground View News and its editors,
                contributors, officers, and agents from any claims, damages, losses, or costs
                (including reasonable legal fees) arising from your use of the Website in violation of
                these Terms or any applicable law.
              </p>
            </Section>

            <Section title="13. Governing Law">
              <p>
                These Terms of Use are governed by and construed in accordance with the laws of
                England and Wales. Any disputes arising under or in connection with these Terms shall
                be subject to the exclusive jurisdiction of the courts of England and Wales.
              </p>
            </Section>

            <Section title="14. Severability">
              <p>
                If any provision of these Terms is found to be unlawful, void, or unenforceable, that
                provision shall be severed from the remaining Terms, which shall continue in full force
                and effect.
              </p>
            </Section>

            <Section title="15. Contact">
              <p>
                If you have questions about these Terms of Use, please contact us:
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
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200 flex gap-6 text-xs text-gray-400">
            <Link href="/privacy-policy" className="hover:text-gray-700 transition-colors">
              Privacy Policy
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
