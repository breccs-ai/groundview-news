'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAdminAuthenticated, setAdminSession } from '@/lib/admin-auth';
import { Eye, EyeOff, Lock } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    if (isAdminAuthenticated()) {
      router.replace('/admin/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      setAdminSession();
      router.push('/admin/dashboard');
    } else {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span
            className="text-2xl font-bold text-white"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            Ground View
          </span>
          <span
            className="text-2xl font-bold ml-1"
            style={{ color: '#d4a017', fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            News
          </span>
          <p className="mt-2 text-xs text-gray-500 uppercase tracking-widest">Admin Panel</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-sm p-8">
          <div className="flex justify-center mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
              <Lock size={16} className="text-gray-400" />
            </div>
          </div>

          <h1
            className="text-lg font-bold text-white text-center mb-6"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            Sign in
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setStatus('idle');
                }}
                placeholder="Admin password"
                required
                autoFocus
                className={`w-full bg-gray-800 border rounded-sm px-4 py-3 text-sm text-white placeholder-gray-500 pr-10 focus:outline-none transition-colors ${
                  status === 'error'
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-gray-700 focus:border-amber-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {status === 'error' && (
              <p className="text-xs text-red-400">Incorrect password. Please try again.</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading' || !password}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm rounded-sm transition-colors disabled:opacity-50"
            >
              {status === 'loading' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center">
          <a href="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← Return to website
          </a>
        </p>
      </div>
    </div>
  );
}
