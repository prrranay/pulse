'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/auth-context';
import { ArrowLeft, User, Shield, Palette } from 'lucide-react';

interface ThemeOption {
  id: string;
  name: string;
  desc: string;
  primaryClass: string;
  accentClass: string;
}

const THEMES: ThemeOption[] = [
  {
    id: 'void',
    name: 'Midnight Void',
    desc: 'Deep space obsidian with sleek indigo and violet glows.',
    primaryClass: 'bg-[#020617] border-[#0f172a]',
    accentClass: 'bg-indigo-600',
  },
  {
    id: 'aurora',
    name: 'Emerald Aurora',
    desc: 'Mystical forest vibe with vibrant emerald and teal highlights.',
    primaryClass: 'bg-[#021a16] border-[#052e26]',
    accentClass: 'bg-emerald-600',
  },
  {
    id: 'rose',
    name: 'Rose Nebula',
    desc: 'Sophisticated space chamber with hot rose and magenta accents.',
    primaryClass: 'bg-[#120410] border-[#240920]',
    accentClass: 'bg-pink-600',
  },
  {
    id: 'cyber',
    name: 'Cyber Orange',
    desc: 'Industrial stone gray matched with retro-future neon amber.',
    primaryClass: 'bg-[#0c0a09] border-[#1c1917]',
    accentClass: 'bg-amber-600',
  },
];

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [activeTheme, setActiveTheme] = useState('void');

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('pulse_theme') || 'void';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTheme(savedTheme);
  }, []);

  const handleSelectTheme = (themeId: string) => {
    localStorage.setItem('pulse_theme', themeId);
    setActiveTheme(themeId);
    if (themeId === 'void') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', themeId);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Settings Navigation Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-900 bg-slate-950/80 px-4 py-3 backdrop-blur-md">
        <button
          onClick={() => router.push('/')}
          className="rounded-full p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-bold text-slate-100">Settings</h2>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            System Preferences
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Customize your workspace styling, themes, and profile options.
          </p>
        </div>

        {/* Themes Selector Section */}
        <section className="rounded-2xl border border-slate-900 bg-slate-900/10 p-6 backdrop-blur-md space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Palette className="h-4.5 w-4.5 text-indigo-400" /> Interface Theme
          </h3>
          <p className="text-xs text-slate-500">
            Select a custom color scheme to refresh the overall aesthetic of your feed.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
            {THEMES.map((theme) => (
              <div
                key={theme.id}
                onClick={() => handleSelectTheme(theme.id)}
                className={`relative flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition-all hover:scale-[1.01] ${
                  theme.primaryClass
                } ${
                  activeTheme === theme.id
                    ? 'ring-2 ring-indigo-500 border-transparent shadow-lg shadow-indigo-500/10'
                    : 'border-slate-900/50 hover:border-slate-800'
                }`}
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${theme.accentClass}`} />
                    {theme.name}
                  </h4>
                  <p className="mt-1 text-[10px] text-slate-500 leading-relaxed">
                    {theme.desc}
                  </p>
                </div>

                {activeTheme === theme.id && (
                  <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded-full border border-indigo-500/25">
                    Active
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Account and Profile Navigation */}
        <section className="rounded-2xl border border-slate-900 bg-slate-900/10 p-6 backdrop-blur-md space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <User className="h-4.5 w-4.5 text-indigo-400" /> Account Settings
          </h3>
          
          <div className="space-y-3 pt-2">
            <div
              onClick={() => router.push('/settings/profile')}
              className="flex items-center justify-between rounded-xl border border-slate-900 bg-slate-950/40 p-4 hover:border-slate-800 hover:bg-slate-900/10 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-600/10 p-2 text-indigo-400">
                  <User className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Edit Profile Info</h4>
                  <p className="text-[10px] text-slate-500">Update display name, avatar, and account bio</p>
                </div>
              </div>
              <ArrowLeft className="h-4 w-4 rotate-180 text-slate-600" />
            </div>

            {user.role === 'ADMIN' && (
              <div
                onClick={() => router.push('/admin')}
                className="flex items-center justify-between rounded-xl border border-slate-900 bg-slate-950/40 p-4 hover:border-slate-800 hover:bg-slate-900/10 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-indigo-600/10 p-2 text-indigo-400">
                    <Shield className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Admin Dashboard</h4>
                    <p className="text-[10px] text-slate-500">Moderate posts, view user analytics, and handle reports</p>
                  </div>
                </div>
                <ArrowLeft className="h-4 w-4 rotate-180 text-slate-600" />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
