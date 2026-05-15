import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Advertiser Terms | Ground View News',
  description: 'Terms for advertisers placing paid placements with Ground View News.',
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

export default function AdvertiserTermsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <div className="mb-12 pb-8 border-b border-gray-200">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-3">Legal</p>
            <h1
              className="text-4xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Advertiser Terms
            </h1>
            <p className="text-sm text-gray-600">
              Ground View News is operated by <strong>Breccs Private Limited</strong>, a company registered in the United
              Kingdom. These terms apply to advertisers using our self-serve advertising tools. They are written in plain
              English and are intended to align with the UK Consumer Rights Act 2015, the UK ASA CAP Code, UK GDPR and EU
              GDPR, the Irish Consumer Protection Act 2007, and the EU e-Commerce Directive (2000/31/EC). They do not
              constitute personal legal advice.
            </p>
          </div>

          <Section title="1. Advertiser Responsibility Clause">
            <p>
              Ground View News (operated by Breccs Private Limited) provides advertising space as a platform service only.
              Ground View News is not responsible for the accuracy, quality, legality, or delivery of any advertised product
              or service. Advertisers are solely responsible for ensuring their advertisements and the products or services
              they promote comply with all applicable laws.
            </p>
          </Section>

          <Section title="2. AI Content Moderation Clause">
            <p>
              All advertisements submitted to Ground View News are subject to automated content review using AI moderation
              tools. Advertisements containing prohibited content including but not limited to hate speech, harassment,
              violent content, sexual content, or promotions of illegal services will be rejected and the advertiser refunded.
              Ground View News reserves the right to reject any advertisement at its sole discretion.
            </p>
          </Section>

          <Section title="3. KYC and Identity Verification Clause">
            <p>
              In compliance with UK and EU anti-fraud and anti-money laundering obligations, all advertisers are required to
              complete identity verification before placing advertisements. Verification is processed by Stripe Identity. A
              one-time verification fee is charged to the advertiser. Breccs Private Limited does not store identity
              documents directly. Verified identity data is held by Stripe in accordance with their privacy policy.
              Stripe Identity collects and processes identity documents including government-issued photo ID such as
              passports and driving licences. A selfie check is not required. Accepted documents include passports,
              driving licences, and national ID cards from all countries. Stripe holds identity data in accordance
              with its privacy policy. Ground View News retains only the verification status — verified or not
              verified — and the date of verification.
            </p>
          </Section>

          <Section title="4. Subscription and Auto-Renewal Clause">
            <p>
              Monthly and annual advertising subscriptions renew automatically at the end of each billing period unless
              cancelled. Advertisers will receive advance notice before each renewal. Cancellation can be made at any time
              from the advertiser dashboard and takes effect at the end of the current billing period. No refunds are issued
              for partial periods.
            </p>
          </Section>

          <Section title="5. Refund Policy">
            <p>
              One-off advertisements rejected by our automated content review system will receive a full refund to the
              original payment method within 5–10 business days. Subscriptions cancelled mid-period are not eligible for
              partial refunds. Refunds for exceptional circumstances are at the discretion of Breccs Private Limited.
            </p>
          </Section>

          <Section title="6. GDPR and Data Processing Clause">
            <p>
              Advertiser data is processed by Breccs Private Limited as data controller under UK GDPR and EU GDPR. Data is
              used solely for account management, ad delivery, billing, and legal compliance. Advertiser data is never sold
              to third parties. Advertisers may request deletion of their data subject to legal retention obligations.
            </p>
          </Section>

          <p className="text-xs text-gray-500 mt-12">
            Last updated: May 2026. For questions contact{' '}
            <a href="mailto:info@groundviewnews.com" className="text-amber-800 underline">
              info@groundviewnews.com
            </a>
            .
          </p>

          <p className="mt-8">
            <Link href="/terms" className="text-amber-800 underline text-sm">
              General terms of use
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
