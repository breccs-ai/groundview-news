import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy | Ground View News',
  description:
    'How Ground View News collects, uses, and protects your personal data under GDPR, UK GDPR, and Irish data protection law.',
};

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10">
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
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-3">Legal</p>
            <h1
              className="text-4xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Privacy Policy
            </h1>
            <p className="text-sm text-gray-500">
              Last updated: May 2026. This policy applies to all visitors to groundviewnews.com.
            </p>
          </div>

          {/* Intro */}
          <p className="text-sm text-gray-700 leading-relaxed mb-10">
            Ground View News (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is committed to
            protecting your personal data. This Privacy Policy explains what personal data we collect,
            why we collect it, how we use it, and your rights under the EU General Data Protection
            Regulation (EU GDPR), the UK General Data Protection Regulation (UK GDPR), and the Irish
            Data Protection Acts 2018. Please read it carefully.
          </p>

          <Section title="1. Who We Are">
            <p>
              Ground View News is an independent digital news commentary publication operated from
              Ireland. Our website is located at{' '}
              <strong>groundviewnews.com</strong>.
            </p>
            <p>
              <strong>Data Controller:</strong> Ground View News
              <br />
              <strong>Registered jurisdiction:</strong> Republic of Ireland
              <br />
              <strong>Contact:</strong>{' '}
              <a
                href="mailto:privacy@groundviewnews.com"
                className="text-amber-700 hover:text-amber-900 underline"
              >
                privacy@groundviewnews.com
              </a>
            </p>
            <p>
              As a data controller established in the Republic of Ireland, our lead supervisory
              authority for EU GDPR purposes is the{' '}
              <strong>Data Protection Commission (DPC) of Ireland</strong>. UK-based visitors also
              have the right to raise concerns with the{' '}
              <strong>UK Information Commissioner&rsquo;s Office (ICO)</strong> in relation to UK GDPR.
            </p>
            <p className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-xs text-amber-900">
              <strong>ICO Registration Note:</strong> Operators processing personal data of UK
              residents for commercial purposes may be required to register with the ICO under the
              UK Data Protection (Charges and Information) Regulations 2018. If Ground View News
              generates revenue from UK-based advertising or services, the operator should ensure
              ICO registration is in place.
            </p>
          </Section>

          <Section title="2. What Personal Data We Collect">
            <p>We collect the following categories of personal data:</p>
            <p>
              <strong>Data you provide directly:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Email address:</strong> when you subscribe to our newsletter via the
                signup form on the site.
              </li>
              <li>
                <strong>Name and email address:</strong> when you submit an enquiry or message via
                the contact form.
              </li>
              <li>
                <strong>Message content:</strong> the text of any enquiry or article pitch you send
                via the contact form.
              </li>
            </ul>
            <p>
              <strong>Data collected automatically when you visit the site:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>IP address:</strong> collected by our hosting provider (Vercel) for
                security, fraud prevention, and infrastructure purposes.
              </li>
              <li>
                <strong>Browser type and operating system:</strong> collected via server logs and,
                with your consent, via analytics cookies.
              </li>
              <li>
                <strong>Pages visited and time on site:</strong> collected with your consent via
                analytics cookies to help us understand how the site is used.
              </li>
              <li>
                <strong>Referring URL:</strong> the page you visited before arriving at Ground View
                News, collected with your consent via analytics.
              </li>
              <li>
                <strong>Cookie consent preference:</strong> stored in your browser&rsquo;s
                localStorage to remember your choice and avoid showing the consent banner
                repeatedly.
              </li>
            </ul>
            <p>
              We do not collect sensitive personal data (special category data under GDPR), financial
              information, or data from children under 16.
            </p>
          </Section>

          <Section title="3. Why We Collect Your Data and Our Legal Basis">
            <p>
              We only process your personal data where we have a lawful basis to do so under EU GDPR
              Article 6 and UK GDPR Article 6.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 w-1/3">
                      Purpose
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 w-1/3">
                      Data used
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 w-1/3">
                      Legal basis
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2">Sending the newsletter</td>
                    <td className="px-3 py-2">Email address</td>
                    <td className="px-3 py-2">Consent (Art. 6(1)(a))</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Responding to contact form enquiries</td>
                    <td className="px-3 py-2">Name, email, message</td>
                    <td className="px-3 py-2">Legitimate interests (Art. 6(1)(f))</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Improving site content and UX via analytics</td>
                    <td className="px-3 py-2">Usage data, cookies</td>
                    <td className="px-3 py-2">Consent (Art. 6(1)(a))</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Security and fraud prevention</td>
                    <td className="px-3 py-2">IP address, server logs</td>
                    <td className="px-3 py-2">Legitimate interests (Art. 6(1)(f))</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Compliance with legal obligations</td>
                    <td className="px-3 py-2">Any data required by law</td>
                    <td className="px-3 py-2">Legal obligation (Art. 6(1)(c))</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Where we rely on <strong>legitimate interests</strong>, we have assessed that our
              interests do not override your fundamental rights and freedoms. You have the right to
              object to processing based on legitimate interests at any time (see Section 9).
            </p>
          </Section>

          <Section title="4. Newsletter Subscriptions">
            <p>
              When you subscribe to the Ground View News newsletter, we collect your email address
              with your explicit consent. We use this address solely to send you editorial updates,
              articles, and publication news.
            </p>
            <p>
              You may unsubscribe at any time by clicking the unsubscribe link included in every
              newsletter email, or by emailing{' '}
              <a
                href="mailto:privacy@groundviewnews.com"
                className="text-amber-700 hover:text-amber-900 underline"
              >
                privacy@groundviewnews.com
              </a>
              . Upon unsubscribing, your email address will be deleted from our subscriber list
              within 30 days.
            </p>
            <p>
              We do not use your email address for any purpose other than sending the newsletter, and
              we do not share your email address with third-party advertisers.
            </p>
          </Section>

          <Section title="5. Cookies" id="cookies">
            <p>
              Cookies are small text files placed on your device when you visit a website. We use the
              following categories of cookies:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">
                      Category
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">
                      Purpose
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">
                      Consent required?
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2 font-medium">Strictly necessary</td>
                    <td className="px-3 py-2">
                      Remembering your cookie consent choice; admin session (admin users only).
                      These are essential for the site to function.
                    </td>
                    <td className="px-3 py-2">No, always active</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Analytics</td>
                    <td className="px-3 py-2">
                      Understanding how visitors use the site: pages visited, time on site,
                      traffic sources. Only set if you click &ldquo;Accept all&rdquo; on the
                      cookie banner.
                    </td>
                    <td className="px-3 py-2">Yes, consent required</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Advertising</td>
                    <td className="px-3 py-2">
                      Where third-party advertising is displayed, ad providers may set cookies.
                      These are only activated where you have given consent.
                    </td>
                    <td className="px-3 py-2">Yes, consent required</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              You can manage or withdraw your cookie consent at any time by clearing your browser
              cookies or using the cookie settings banner, which reappears when cookies are cleared.
              Withdrawing consent does not affect the lawfulness of processing carried out before
              withdrawal.
            </p>
            <p>
              Our use of cookies for analytics purposes is governed by the EU ePrivacy Directive
              (2002/58/EC) and, for UK visitors, the Privacy and Electronic Communications
              Regulations 2003 (PECR). We do not set non-essential cookies without your prior
              consent.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain your personal data only for as long as necessary for the purposes for which
              it was collected:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Newsletter email addresses:</strong> retained until you unsubscribe, after
                which they are deleted within 30 days.
              </li>
              <li>
                <strong>Contact form submissions:</strong> retained for a maximum of 12 months from
                the date of receipt, then deleted, unless an ongoing legal or editorial matter
                requires retention.
              </li>
              <li>
                <strong>Analytics data:</strong> if analytics cookies are accepted, aggregated
                usage data may be retained indefinitely; any data linked to an identifiable
                individual is deleted after 26 months.
              </li>
              <li>
                <strong>Server logs (IP addresses):</strong> retained by Vercel for up to 30 days
                for security purposes.
              </li>
            </ul>
          </Section>

          <Section title="7. Third-Party Processors">
            <p>
              We share data with the following trusted third-party processors who act on our
              instructions and are bound by appropriate data processing agreements:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">
                      Processor
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">
                      Purpose
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">
                      Data transferred
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">
                      Location
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2 font-medium">Supabase</td>
                    <td className="px-3 py-2">
                      Database storage: subscriber email addresses, article content, contact
                      form data
                    </td>
                    <td className="px-3 py-2">Email, form submissions</td>
                    <td className="px-3 py-2">EU (AWS eu-west-1)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Vercel</td>
                    <td className="px-3 py-2">
                      Website hosting, CDN, and edge infrastructure
                    </td>
                    <td className="px-3 py-2">IP address, server logs</td>
                    <td className="px-3 py-2">Global CDN (EU nodes available)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Resend</td>
                    <td className="px-3 py-2">
                      Transactional and newsletter email delivery
                    </td>
                    <td className="px-3 py-2">Email address</td>
                    <td className="px-3 py-2">US (Standard Contractual Clauses apply)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Where processors are located outside the EU/EEA or UK, we ensure appropriate
              safeguards are in place, including EU Standard Contractual Clauses (SCCs) or the UK
              International Data Transfer Agreement (IDTA).
            </p>
            <p>
              We do not sell your personal data to any third party. We do not share subscriber email
              addresses with advertisers.
            </p>
          </Section>

          <Section title="8. Advertising">
            <p>
              Ground View News displays third-party advertising. Advertisers and their technology
              partners may use cookies and similar tracking technologies to serve targeted
              advertisements. These cookies are only activated if you consent via our cookie banner.
            </p>
            <p>
              We are not responsible for the privacy practices of advertising networks. Where we
              display advertising provided by third parties (such as Google AdSense or similar
              platforms), those platforms operate under their own privacy policies. We encourage you
              to review the privacy policies of any third-party service whose advertising you see on
              our site.
            </p>
            <p>
              Advertising content is clearly labelled as &ldquo;Sponsored&rdquo; or
              &ldquo;Advertisement&rdquo; and is distinct from editorial content.
            </p>
          </Section>

          <Section title="9. Your Rights">
            <p>
              Under EU GDPR and UK GDPR, you have the following rights in relation to your personal
              data:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Right of access (Art. 15):</strong> You may request a copy of the personal
                data we hold about you.
              </li>
              <li>
                <strong>Right to rectification (Art. 16):</strong> You may ask us to correct
                inaccurate or incomplete data.
              </li>
              <li>
                <strong>Right to erasure (Art. 17):</strong> You may ask us to delete your personal
                data where we no longer have a lawful basis to hold it.
              </li>
              <li>
                <strong>Right to restriction (Art. 18):</strong> You may ask us to restrict how
                we use your data pending resolution of a dispute or objection.
              </li>
              <li>
                <strong>Right to data portability (Art. 20):</strong> Where processing is based on
                consent or contract, you may receive your data in a structured, machine-readable
                format.
              </li>
              <li>
                <strong>Right to object (Art. 21):</strong> You may object to processing based on
                legitimate interests. We will cease processing unless we can demonstrate compelling
                legitimate grounds that override your interests.
              </li>
              <li>
                <strong>Right to withdraw consent:</strong> Where processing is based on consent,
                you may withdraw consent at any time. This does not affect the lawfulness of
                processing prior to withdrawal.
              </li>
            </ul>
            <p>
              To exercise any of these rights, please email{' '}
              <a
                href="mailto:privacy@groundviewnews.com"
                className="text-amber-700 hover:text-amber-900 underline"
              >
                privacy@groundviewnews.com
              </a>
              . We will respond within one month. We may ask you to verify your identity before
              acting on a request.
            </p>
          </Section>

          <Section title="10. Right to Complain">
            <p>
              You have the right to lodge a complaint with a supervisory authority if you believe
              your personal data has been processed in a way that does not comply with applicable
              data protection law.
            </p>
            <p>
              <strong>For EU visitors:</strong>
              <br />
              Data Protection Commission (DPC), Ireland
              <br />
              Website:{' '}
              <a
                href="https://www.dataprotection.ie"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-700 hover:text-amber-900 underline"
              >
                www.dataprotection.ie
              </a>
              <br />
              Tel: +353 57 868 4800
            </p>
            <p>
              <strong>For UK visitors:</strong>
              <br />
              Information Commissioner&rsquo;s Office (ICO)
              <br />
              Website:{' '}
              <a
                href="https://ico.org.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-700 hover:text-amber-900 underline"
              >
                ico.org.uk
              </a>
              <br />
              Tel: 0303 123 1113
            </p>
            <p>
              We ask that you contact us first before raising a complaint with a supervisory
              authority, as we may be able to resolve your concern directly.
            </p>
          </Section>

          <Section title="11. Children's Privacy">
            <p>
              Our website is not directed at children under the age of 16. We do not knowingly
              collect personal data from children. If you believe a child under 16 has provided us
              with personal data, please contact us at{' '}
              <a
                href="mailto:privacy@groundviewnews.com"
                className="text-amber-700 hover:text-amber-900 underline"
              >
                privacy@groundviewnews.com
              </a>{' '}
              and we will promptly delete it.
            </p>
          </Section>

          <Section title="12. Security">
            <p>
              We implement appropriate technical and organisational measures to protect your personal
              data against unauthorised access, loss, alteration, or disclosure. These measures
              include:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Encrypted data transmission (HTTPS/TLS) for all site traffic.
              </li>
              <li>
                Row-level security policies on our database (Supabase) so that data is accessible
                only to authorised processes.
              </li>
              <li>
                Access controls limiting administrative access to authorised personnel only.
              </li>
              <li>
                No storage of payment card data or financial information on our systems.
              </li>
            </ul>
            <p>
              No system connected to the internet can be guaranteed to be completely secure. In the
              event of a personal data breach that is likely to result in a risk to your rights and
              freedoms, we will notify the DPC within 72 hours and affected individuals without
              undue delay, as required by GDPR Article 33&ndash;34.
            </p>
          </Section>

          <Section title="13. International Data Transfers">
            <p>
              Ground View News is based in Ireland and primarily processes data within the
              EU/EEA. Where personal data is transferred to a country outside the EU/EEA or the UK
              (such as the United States, where Resend operates), we ensure that appropriate
              safeguards are in place:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>EU transfers:</strong> Standard Contractual Clauses (SCCs) approved by the
                European Commission under GDPR Article 46(2)(c).
              </li>
              <li>
                <strong>UK transfers:</strong> UK International Data Transfer Agreement (IDTA) or
                UK Addendum to SCCs.
              </li>
            </ul>
          </Section>

          <Section title="14. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will update the
              &ldquo;Last updated&rdquo; date at the top of this page. For material changes, we will
              take reasonable steps to notify subscribers. Continued use of the site after changes
              are posted constitutes acceptance of the revised policy.
            </p>
          </Section>

          <Section title="15. Contact">
            <p>
              For any questions, requests, or concerns about this Privacy Policy or how we handle
              your personal data:
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
          </Section>

          <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-6 text-xs text-gray-400">
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
