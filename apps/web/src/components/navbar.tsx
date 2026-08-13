'use client';

import Link from 'next/link';
import { useAuth } from '../hooks/auth-context';
import ChatBadge from './chat-badge';
import NotificationBell from './notification-bell';
import { Shield, Home, Settings, Search } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 md:px-8 py-3">
        <Link
          href="/"
          className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-xl font-black tracking-wider text-transparent"
        >
          Pulse
        </Link>

        <div className="flex items-center gap-3">
          {/* Admin Dashboard toggle for privileged accounts */}
          {user.role === 'ADMIN' && (
            <Link
              href="/admin-panel"
              className="flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-1 text-xs font-bold text-indigo-400 hover:bg-indigo-500/10 transition-all mr-1 shrink-0"
            >
              <Shield className="h-3.5 w-3.5" /> Dashboard
            </Link>
          )}

          <Link
            href="/"
            title="Home"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all"
          >
            <Home className="h-4.5 w-4.5" />
          </Link>

          <Link
            href="/explore"
            title="Explore & Search"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all"
          >
            <Search className="h-4.5 w-4.5" />
          </Link>

          <ChatBadge />
          <NotificationBell />

          <Link
            href="/settings"
            title="Settings"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all"
          >
            <Settings className="h-4.5 w-4.5" />
          </Link>

          <Link
            href={`/${user.username}`}
            className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all border-l border-slate-900 pl-3"
          >
            @{user.username}
          </Link>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-900 bg-slate-900/50 hover:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
