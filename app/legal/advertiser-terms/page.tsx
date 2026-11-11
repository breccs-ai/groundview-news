import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Advertiser Terms | Ground View News',
  description: 'Terms for advertisers placing paid placements with Ground View News.',
  alternates: { canonical: '/legal/advertiser-terms' },
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
              Ground View News is operated by <strong>Breccs Private Limited</strong> (company number 15139888),
              registered in England and Wales, with its registered office at 128 City Road, London, EC1V 2NX. These
              terms apply to advertisers using our self-serve advertising tools. They are written in plain
              English and are intended to align with the UK Consumer Rights Act 2015, the UK Consumer Protection from
              Unfair Trading Regulations 2008, the UK ASA CAP Code, UK GDPR, and, where advertisers or readers are based
              in the EU, EU GDPR and the EU e-Commerce Directive (2000/31/EC). They do not constitute personal legal
              advice.
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
              Advertisements for gambling are also reviewed manually before they are published (see clause 7). Ground View
              News reserves the right to reject any advertisement at its sole discretion.
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
              original payment method within 5–10 business days. Advertisements declined following manual review under
              clause 7 will also receive a full refund to the original payment method, and any related subscription will
              be cancelled. Subscriptions cancelled mid-period are not eligible for partial refunds. Refunds for
              exceptional circumstances are at the discretion of Breccs Private Limited.
            </p>
          </Section>

          <Section title="6. GDPR and Data Processing Clause">
            <p>
              Advertiser data is processed by Breccs Private Limited as data controller under UK GDPR and EU GDPR. Data is
              used solely for account management, ad delivery, billing, and legal compliance. Advertiser data is never sold
              to third parties. Advertisers may request deletion of their data subject to legal retention obligations.
            </p>
          </Section>

          <Section title="7. Gambling Advertising Clause">
            <p>
              Advertisements for gambling products or services, or that link to gambling websites, are subject to manual
              review and approval by Ground View News before they are published. This includes, for example, casinos,
              betting and sportsbooks, bingo, poker, lotteries, and websites that promote or refer visitors to them,
              including affiliate and lead-generation sites.
            </p>
            <p>
              If we identify your advertisement as gambling advertising, payment is taken as normal but the advertisement
              will not be published until we have approved it. We will email you when the review is complete. If we
              approve it, it will go live and run for the period you purchased, starting from the date it goes live. If
              we decline it, we will refund you in full under clause 5.
            </p>
            <p>
              If your advertisement promotes gambling, you must not disguise this, and you must be properly authorised to
              offer the gambling you promote to the audience you are targeting. For readers in the United Kingdom, that
              means holding the relevant licence from the UK Gambling Commission, and your advertisement must comply with
              the Gambling Commission&rsquo;s licence conditions and the ASA CAP Code, including the rules on protecting
              under-18s and on responsible gambling. We may ask you for your licence details and any other information we
              reasonably need before we decide, and we may decline the advertisement if you do not provide it.
            </p>
            <p>
              Approval of an advertisement is not an endorsement of the advertiser or its services. We may decline any
              gambling advertisement at our sole discretion. We may also remove an approved advertisement at any time if it
              breaches these terms, if your licence is withdrawn or suspended, or if we are required to by law or by a
              regulator, and we will tell you by email if we do. Our Refund Policy in clause 5 applies.
            </p>
          </Section>

          <p className="text-xs text-gray-500 mt-12">
            Last updated: November 2026. For questions contact{' '}
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
