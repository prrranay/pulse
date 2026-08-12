'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../hooks/auth-context';
import { apiClient } from '../../lib/api-client';
import { User, ApiResponse } from '../../types';
import { z } from 'zod';

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, { message: 'Username or Email is required' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

export default function LoginPage() {
  const [form, setForm] = useState({ usernameOrEmail: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validation = loginSchema.safeParse(form);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const path = issue.path[0];
        if (path) {
          fieldErrors[path.toString()] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post<ApiResponse<{ user: User; accessToken: string }>>(
        '/auth/login',
        form,
      );

      login(res.data.accessToken, res.data.user);
      router.push('/');
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setSubmitError(apiErr?.message ?? 'Invalid credentials. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-indigo-500/10 blur-[80px]" />
      <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-emerald-500/10 blur-[90px]" />

      <div className="relative w-full max-w-md">
        {/* Brand Logo / Title */}
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
            Pulse
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to join the technical stream
          </p>
        </div>

        {/* Card Form container */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-xl shadow-2xl">
          {submitError && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="usernameOrEmail"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Username or Email
              </label>
              <input
                id="usernameOrEmail"
                name="usernameOrEmail"
                type="text"
                autoComplete="username"
                value={form.usernameOrEmail}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="developer@pulse.dev"
              />
              {errors.usernameOrEmail && (
                <p className="mt-1 text-xs text-red-400">{errors.usernameOrEmail}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  Password
                </label>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="relative w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-xs text-slate-500">Don&apos;t have an account? </span>
            <Link
              href="/register"
              className="text-xs font-semibold text-indigo-400 transition-all hover:text-indigo-300"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
