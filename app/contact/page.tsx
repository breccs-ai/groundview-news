'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { CircleCheck as CheckCircle, Mail } from 'lucide-react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      setErrorMsg('Something went wrong. Please try again.');
      setStatus('error');
    } else {
      setStatus('success');
      setForm({ name: '', email: '', subject: '', message: '' });
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
              Contact
            </p>
            <h1
              className="text-4xl md:text-5xl font-bold text-white leading-tight"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Get in touch
            </h1>
            <p className="mt-4 text-gray-400 text-base max-w-xl leading-relaxed">
              For editorial enquiries, corrections, press releases, or general questions.
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Sidebar info */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2
                  className="text-lg font-bold text-gray-900 mb-4"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                >
                  Editorial
                </h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Mail size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Editorial queries</p>
                      <p className="text-sm text-gray-500">editorial@groundviewnews.com</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Tips &amp; stories</p>
                      <p className="text-sm text-gray-500">tips@groundviewnews.com</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Corrections</p>
                      <p className="text-sm text-gray-500">corrections@groundviewnews.com</p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h2
                  className="text-lg font-bold text-gray-900 mb-4"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                >
                  Advertising
                </h2>
                <div className="flex items-start gap-3">
                  <Mail size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Advertising enquiries</p>
                    <p className="text-sm text-gray-500">advertising@groundviewnews.com</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Or use our{' '}
                      <a href="/advertise" className="text-blue-800 underline hover:no-underline">
                        advertising enquiry form
                      </a>
                      .
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-sm text-sm text-gray-600 leading-relaxed">
                We aim to respond to all correspondence within five working days. For urgent editorial
                matters, please indicate this in your subject line.
              </div>
            </div>

            {/* Contact form */}
            <div className="lg:col-span-3">
              <h2
                className="text-lg font-bold text-gray-900 mb-6"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                Send us a message
              </h2>

              {status === 'success' ? (
                <div className="flex items-start gap-3 p-5 bg-green-50 border border-green-200 rounded-sm">
                  <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">Message sent</p>
                    <p className="text-sm text-green-700 mt-1">
                      Thank you for getting in touch. We&apos;ll respond within five working days.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                        Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        required
                        className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                        Email *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        required
                        className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                      Subject *
                    </label>
                    <input
                      type="text"
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                      placeholder="What is this regarding?"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                      Message *
                    </label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      required
                      rows={6}
                      className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors resize-y"
                      placeholder="Your message…"
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
                    {status === 'loading' ? 'Sending…' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
