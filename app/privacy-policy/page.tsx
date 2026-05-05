import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy — Ground View News',
  description: 'How Ground View News collects, uses, and protects your personal information.',
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

export default function PrivacyPolicyPage() {
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
              Privacy Policy
            </h1>
            <p className="text-sm text-gray-500">
              Last updated: 5 May 2026. Effective date: 5 May 2026.
            </p>
          </div>

          <div className="prose-sm">
            <Section title="1. Who We Are">
              <p>
                Ground View News ("we", "us", or "our") is an independent digital publication
                covering global affairs, with a focus on Africa, the African diaspora, human rights,
                world politics, and the global economy. Our website is located at{' '}
                <strong>groundviewnews.com</strong>.
              </p>
              <p>
                We are committed to protecting your personal information and your right to privacy.
                This Privacy Policy explains what information we collect, how we use it, and your
                rights regarding that information.
              </p>
            </Section>

            <Section title="2. Information We Collect">
              <p>We collect the following categories of information:</p>
              <p>
                <strong>Information you provide directly:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Newsletter subscriptions:</strong> your email address when you sign up for
                  our newsletter.
                </li>
                <li>
                  <strong>Contact form submissions:</strong> your name, email address, subject, and
                  message when you contact us.
                </li>
                <li>
                  <strong>Article submissions:</strong> any information you include when pitching or
                  submitting an article for consideration.
                </li>
              </ul>
              <p>
                <strong>Information collected automatically:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Usage data:</strong> pages visited, time spent, referring URLs, and browser
                  type, collected via analytics tools.
                </li>
                <li>
                  <strong>Cookies and similar technologies:</strong> small files stored on your device
                  to remember your preferences and improve your experience. See Section 6 for details.
                </li>
                <li>
                  <strong>IP address:</strong> collected automatically by our hosting provider for
                  security and abuse prevention.
                </li>
              </ul>
            </Section>

            <Section title="3. How We Use Your Information">
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Deliver our newsletter and editorial updates to subscribers.</li>
                <li>Respond to enquiries and contact form submissions.</li>
                <li>Improve our website, content, and user experience through analytics.</li>
                <li>Detect and prevent fraud, abuse, and security threats.</li>
                <li>Comply with applicable legal obligations.</li>
              </ul>
              <p>
                We do not sell, rent, or trade your personal information to third parties for
                marketing purposes.
              </p>
            </Section>

            <Section title="4. Legal Basis for Processing (GDPR)">
              <p>
                Where the General Data Protection Regulation (GDPR) applies, we rely on the following
                legal bases:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Consent:</strong> for newsletter subscriptions and non-essential cookies.
                  You may withdraw consent at any time.
                </li>
                <li>
                  <strong>Legitimate interests:</strong> for analytics and security, where our
                  interests do not override your rights.
                </li>
                <li>
                  <strong>Legal obligation:</strong> where required by applicable law.
                </li>
              </ul>
            </Section>

            <Section title="5. Data Retention">
              <p>
                We retain your data only for as long as necessary for the purposes described in this
                policy:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Newsletter subscriptions:</strong> retained until you unsubscribe.
                </li>
                <li>
                  <strong>Contact messages:</strong> retained for up to 2 years for correspondence
                  records, then deleted.
                </li>
                <li>
                  <strong>Analytics data:</strong> retained in aggregated or anonymised form
                  indefinitely; identifiable data deleted after 26 months.
                </li>
              </ul>
            </Section>

            <Section title="6. Cookies">
              <p>
                We use cookies and similar tracking technologies to operate our website and understand
                how it is used. Cookies fall into the following categories:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Strictly necessary:</strong> required for the website to function (e.g.,
                  remembering your cookie consent choice). These cannot be disabled.
                </li>
                <li>
                  <strong>Analytics:</strong> help us understand how visitors interact with the
                  site. Only set with your consent.
                </li>
                <li>
                  <strong>Preferences:</strong> remember your settings and improve your experience.
                  Only set with your consent.
                </li>
              </ul>
              <p>
                You can manage or withdraw cookie consent at any time using the cookie banner shown on
                your first visit, or by clearing your browser cookies.
              </p>
            </Section>

            <Section title="7. Third-Party Services">
              <p>
                We may use the following third-party services that may process your data in accordance
                with their own privacy policies:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Supabase:</strong> database and backend infrastructure. Data is stored on
                  servers within the European Economic Area (EEA) or equivalent jurisdictions.
                </li>
                <li>
                  <strong>Vercel:</strong> website hosting and content delivery.
                </li>
                <li>
                  <strong>Cloudflare:</strong> DNS, CDN, and security services.
                </li>
                <li>
                  <strong>Analytics providers:</strong> we may use privacy-focused analytics tools
                  that do not track individuals across sites.
                </li>
              </ul>
              <p>
                We take reasonable steps to ensure third-party processors handle your data lawfully
                and securely.
              </p>
            </Section>

            <Section title="8. Your Rights">
              <p>
                Depending on your location, you may have the following rights regarding your personal
                data:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Access:</strong> request a copy of the personal data we hold about you.
                </li>
                <li>
                  <strong>Rectification:</strong> request correction of inaccurate data.
                </li>
                <li>
                  <strong>Erasure:</strong> request deletion of your data ("right to be forgotten").
                </li>
                <li>
                  <strong>Restriction:</strong> request that we limit how we use your data.
                </li>
                <li>
                  <strong>Portability:</strong> receive your data in a machine-readable format.
                </li>
                <li>
                  <strong>Objection:</strong> object to processing based on legitimate interests.
                </li>
                <li>
                  <strong>Withdraw consent:</strong> withdraw consent at any time for consent-based
                  processing.
                </li>
              </ul>
              <p>
                To exercise any of these rights, contact us at{' '}
                <a
                  href="mailto:privacy@groundviewnews.com"
                  className="text-amber-700 hover:text-amber-900 underline"
                >
                  privacy@groundviewnews.com
                </a>
                . We will respond within 30 days.
              </p>
            </Section>

            <Section title="9. Children's Privacy">
              <p>
                Our website is not directed at children under the age of 16. We do not knowingly
                collect personal information from children. If you believe a child has provided us
                with personal data, please contact us and we will delete it promptly.
              </p>
            </Section>

            <Section title="10. Security">
              <p>
                We implement appropriate technical and organisational measures to protect your
                personal data against unauthorised access, loss, or destruction. These include
                encrypted data transmission (HTTPS), row-level database security, and access controls
                for our systems. No method of transmission over the internet is completely secure,
                and we cannot guarantee absolute security.
              </p>
            </Section>

            <Section title="11. International Transfers">
              <p>
                Where personal data is transferred outside the UK or EEA, we ensure appropriate
                safeguards are in place, such as standard contractual clauses approved by the
                European Commission or equivalent mechanisms.
              </p>
            </Section>

            <Section title="12. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. When we do, we will revise the
                "Last updated" date at the top of this page. We encourage you to review this policy
                periodically. Continued use of the website after changes constitutes your acceptance
                of the revised policy.
              </p>
            </Section>

            <Section title="13. Contact Us">
              <p>
                If you have any questions, concerns, or complaints about this Privacy Policy or our
                data practices, please contact us:
              </p>
              <p>
                <strong>Ground View News</strong>
                <br />
                Email:{' '}
                <a
                  href="mailto:privacy@groundviewnews.com"
                  className="text-amber-700 hover:text-amber-900 underline"
                >
                  privacy@groundviewnews.com
                </a>
                <br />
                Website:{' '}
                <Link href="/contact" className="text-amber-700 hover:text-amber-900 underline">
                  groundviewnews.com/contact
                </Link>
              </p>
              <p>
                You also have the right to lodge a complaint with your local data protection
                authority if you believe we have not handled your data in accordance with applicable
                law.
              </p>
            </Section>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200 flex gap-6 text-xs text-gray-400">
            <Link href="/terms-of-use" className="hover:text-gray-700 transition-colors">
              Terms of Use
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
