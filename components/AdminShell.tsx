'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isAdminAuthenticated, clearAdminSession } from '@/lib/admin-auth';
import {
  LayoutDashboard,
  FilePlus,
  LogOut,
  Globe,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/articles/new', label: 'New Article', icon: FilePlus },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace('/admin');
    } else {
      setChecked(true);
    }
  }, [router]);

  const handleLogout = () => {
    clearAdminSession();
    router.push('/admin');
  };

  if (!checked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-56 z-30 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: '#0f1f3d' }}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <span
              className="text-base font-bold text-white"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Ground View
            </span>
            <span
              className="text-base font-bold ml-1"
              style={{ color: '#d4a017', fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              News
            </span>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Admin</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-gray-400 hover:bg-white/8 hover:text-white'
                }`}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium text-gray-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <Globe size={15} />
            View site
          </a>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-white/8 transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-900"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-gray-700">Admin Panel</span>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
