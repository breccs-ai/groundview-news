'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { CircleCheck as CheckCircle, LayoutTemplate, AlignCenter, PanelTop } from 'lucide-react';
import {
  getAnnualPriceLines,
  getMonthlyPriceGbp,
  type PlacementTier,
} from '@/lib/advertiser/pricing';
import { PLACEMENT_TIER_DESCRIPTIONS, PLACEMENT_TIER_NAMES } from '@/lib/advertiser/placements';

// Prices and placement descriptions come from the same modules the advertiser
// portal uses, so this page cannot drift from what checkout actually charges.
const TIERS: PlacementTier[] = ['basic', 'standard', 'premium'];

const packages = TIERS.map((tier) => ({
  tier,
  name: PLACEMENT_TIER_NAMES[tier],
  price: `£${getMonthlyPriceGbp(tier)}`,
  description: PLACEMENT_TIER_DESCRIPTIONS[tier],
  annual: getAnnualPriceLines(tier),
}));

const placements = [
  {
    icon: PanelTop,
    title: 'Homepage Featured',
    body: 'A featured slot at the top of the homepage. Included with the Premium plan.',
  },
  {
    icon: AlignCenter,
    title: 'In-Article',
    body: 'Placed within the article body, seen by readers at the point of highest engagement. Included with Standard and Premium.',
  },
  {
    icon: LayoutTemplate,
    title: 'Sidebar and Footer',
    body: 'Displayed alongside article and homepage content, and in the footer banner. Included with every plan.',
  },
];

export default function AdvertisePage() {
  const [form, setForm] = useState({
    name: '',
    contact_name: '',
    email: '',
    package_interest: '',
    message: '',
    website: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    const res = await fetch('/api/advertise-enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      setErrorMsg('Something went wrong. Please try again or email us directly.');
      setStatus('error');
    } else {
      setStatus('success');
      setForm({ name: '', contact_name: '', email: '', package_interest: '', message: '', website: '' });
    }
  };

  return (
    <>
      <Navbar />

      <main className="bg-white">
        {/* Header */}
        <div style={{ backgroundColor: '#0f1f3d' }} className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">
              Advertising
            </p>
            <h1
              className="text-4xl md:text-5xl font-bold text-white leading-tight"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Reach a global, engaged audience
            </h1>
            <p className="mt-4 text-gray-400 text-base leading-relaxed max-w-xl">
              Ground View News reaches a global readership across every continent.
              Our audience is educated, internationally minded, and reads in depth.
            </p>
          </div>
        </div>

        {/* Packages */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <h2
            className="text-2xl font-bold text-gray-900 mb-8"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            Advertising Packages
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {packages.map((pkg) => (
              <div
                key={pkg.tier}
                className="p-6 border border-gray-200 bg-white hover:border-gray-400 transition-colors rounded-sm flex flex-col"
              >
                <h3
                  className="text-base font-bold text-gray-900 mb-2"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                >
                  {pkg.name}
                </h3>
                <div className="flex items-end gap-2 mb-1">
                  <span
                    className="text-3xl font-bold text-gray-900"
                    style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                  >
                    {pkg.price}
                  </span>
                  <span className="text-sm text-gray-400 mb-1">/ month</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  or {pkg.annual.annualTotal} (save about {pkg.annual.savingsPercent}%)
                </p>
                <p className="text-sm text-gray-600 leading-relaxed flex-1">{pkg.description}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-gray-500">
            Monthly plans renew automatically and can be cancelled at any time from your advertiser
            dashboard. All advertisers complete a one-time identity verification when they sign up,
            and every ad is reviewed before it goes live.
          </p>
          <p className="mt-2 text-sm text-gray-400">
            All prices exclude VAT where applicable.
          </p>
          <Link
            href="/advertiser/register"
            className="mt-6 inline-block px-6 py-3 bg-gray-900 hover:bg-blue-900 text-white font-semibold text-sm rounded-sm transition-colors duration-150"
          >
            Sign up and book online
          </Link>
        </section>

        {/* Placement options */}
        <section className="bg-gray-50 py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2
              className="text-2xl font-bold text-gray-900 mb-8"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Placement Options
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {placements.map((p) => (
                <div key={p.title} className="bg-white p-6 border border-gray-100 rounded-sm">
                  <div
                    className="w-10 h-10 rounded-sm flex items-center justify-center mb-4"
                    style={{ backgroundColor: '#e8edf5' }}
                  >
                    <p.icon size={18} style={{ color: '#0f1f3d' }} />
                  </div>
                  <h3
                    className="text-base font-bold text-gray-900 mb-2"
                    style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                  >
                    {p.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Enquiry form */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
          <h2
            className="text-2xl font-bold text-gray-900 mb-2"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            Advertising Enquiry
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            Complete the form below and our advertising team will respond within two working days.
          </p>

          {status === 'success' ? (
            <div className="flex items-start gap-3 p-5 bg-green-50 border border-green-200 rounded-sm">
              <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Enquiry received</p>
                <p className="text-sm text-green-700 mt-1">
                  Thank you. Our advertising team will be in touch shortly.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div
                className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden"
                aria-hidden="true"
              >
                <label htmlFor="advertise-website">Website</label>
                <input
                  id="advertise-website"
                  type="text"
                  name="website"
                  value={form.website}
                  onChange={handleChange}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                    placeholder="Acme Ltd"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    name="contact_name"
                    value={form.contact_name}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                    placeholder="Jane Smith"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                  placeholder="jane@acme.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Package Interest
                </label>
                <select
                  name="package_interest"
                  value={form.package_interest}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors bg-white"
                >
                  <option value="">Select a package</option>
                  {packages.map((pkg) => (
                    <option key={pkg.tier} value={`${pkg.name} (${pkg.price}/month)`}>
                      {pkg.name} ({pkg.price}/month)
                    </option>
                  ))}
                  <option value="Custom">Custom / not sure yet</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Message
                </label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  rows={5}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors resize-y"
                  placeholder="Tell us about your campaign goals, audience, and any questions you have…"
                />
              </div>
              {status === 'error' && (
                <p className="text-sm text-red-600">{errorMsg}</p>
              )}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-3 bg-gray-900 hover:bg-blue-900 text-white font-semibold text-sm rounded-sm transition-colors duration-150 disabled:opacity-60"
              >
                {status === 'loading' ? 'Sending…' : 'Send Enquiry'}
              </button>
            </form>
          )}
        </section>
      </main>

      <Footer />
    </>
  );
}
