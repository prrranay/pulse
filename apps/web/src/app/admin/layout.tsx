'use client';

import { useEffect } from 'react';
import { useAuth } from '../../hooks/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  Users,
  AlertTriangle,
  BarChart3,
  Home,
  LayoutDashboard,
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  // Double check authorization to prevent rendering flash of admin content
  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-center px-4 text-slate-100">
        <Shield className="h-16 w-16 text-red-500 mb-4 animate-pulse" />
        <h1 className="text-xl font-black tracking-tight sm:text-2xl">Access Denied</h1>
        <p className="mt-2 text-xs text-slate-500 max-w-sm">
          You do not have administrative privileges to access the command center.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-all"
        >
          Return Home
        </Link>
      </div>
    );
  }

  const menuItems = [
    { name: 'Overview', path: '/admin', icon: LayoutDashboard },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Moderation', path: '/admin/moderation', icon: AlertTriangle },
    { name: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-900 bg-slate-950 flex flex-col shrink-0">
        {/* Brand/Header */}
        <div className="p-6 border-b border-slate-900 flex items-center gap-2">
          <Shield className="h-6 w-6 text-indigo-500" />
          <div>
            <h1 className="text-sm font-black tracking-wider text-slate-200">PULSE</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Admin Panel</p>
          </div>
        </div>

        {/* Menu Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-xl transition-all ${
                  isActive
                    ? 'bg-indigo-600/10 border-l-2 border-indigo-500 text-indigo-400'
                    : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-900 space-y-3">
          <div className="flex items-center gap-2 px-2">
            <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 uppercase">
              {user.username.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold truncate text-slate-300">
                {user.displayName || user.username}
              </p>
              <p className="text-[8px] text-slate-500 truncate">@{user.username}</p>
            </div>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-900 bg-slate-900/10 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-all"
          >
            <Home className="h-3.5 w-3.5" /> Back to App
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
        <div className="mx-auto max-w-5xl">
          {children}
        </div>
      </main>
    </div>
  );
}
