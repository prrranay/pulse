'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../hooks/auth-context';
import { apiClient } from '../../lib/api-client';
import { User, ApiResponse } from '../../types';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email({ message: 'Please provide a valid email address' }),
  username: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters' })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: 'Username can only contain letters, numbers, and underscores',
    }),
  displayName: z.string().optional(),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    username: '',
    displayName: '',
    password: '',
  });
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

    const validation = registerSchema.safeParse(form);
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
      // 1. Register User
      await apiClient.post<ApiResponse<Omit<User, 'password'>>>('/auth/register', form);

      // 2. Automatically log in after registration
      const loginRes = await apiClient.post<ApiResponse<{ user: User; accessToken: string }>>(
        '/auth/login',
        {
          usernameOrEmail: form.username,
          password: form.password,
        },
      );

      login(loginRes.data.accessToken, loginRes.data.user);
      router.push('/');
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setSubmitError(apiErr?.message ?? 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [googleInitialized, setGoogleInitialized] = useState(false);

  const handleGoogleCredentialResponse = async (response: { credential: string }) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiClient.post<ApiResponse<{ user: User; accessToken: string }>>(
        '/auth/google',
        { idToken: response.credential },
      );
      login(res.data.accessToken, res.data.user);
      router.push('/');
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setSubmitError(apiErr?.message ?? 'Google registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initGoogle = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'mock-client-id';
    (window as any).google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredentialResponse,
    });
    setGoogleInitialized(true);
  };

  useEffect(() => {
    // Check if script is already present
    const existingScript = document.getElementById('google-gsi-client');
    if (existingScript) {
      if ((window as any).google) {
        setTimeout(() => initGoogle(), 0);
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if ((window as any).google) {
        setTimeout(() => initGoogle(), 0);
      }
    };
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerMockGoogleLogin = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiClient.post<ApiResponse<{ user: User; accessToken: string }>>(
        '/auth/google',
        { idToken: 'valid-google-id-token' },
      );
      login(res.data.accessToken, res.data.user);
      router.push('/');
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setSubmitError(apiErr?.message ?? 'Mock Google login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (googleInitialized && (window as any).google) {
      const btnContainer = document.getElementById('google-signin-btn');
      if (btnContainer) {
        (window as any).google.accounts.id.renderButton(btnContainer, {
          theme: 'filled_dark',
          size: 'large',
          text: 'signup_with',
          width: btnContainer.clientWidth || 380,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleInitialized]);

  const showMockGoogle = !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID === 'mock-client-id';

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
      <div className="absolute top-1/4 right-1/4 h-72 w-72 rounded-full bg-indigo-500/10 blur-[80px]" />
      <div className="absolute bottom-1/4 left-1/4 h-80 w-80 rounded-full bg-emerald-500/10 blur-[90px]" />

      <div className="relative w-full max-w-md">
        {/* Brand Logo / Title */}
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
            Pulse
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Create an account to join the community
          </p>
        </div>

        {/* Card Form container */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-xl shadow-2xl">
          {submitError && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="dev@pulse.dev"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-400">{errors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={form.username}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="developer_mode"
              />
              {errors.username && (
                <p className="mt-1 text-xs text-red-400">{errors.username}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="displayName"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Display Name (Optional)
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                value={form.displayName}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Jane Dev"
              />
              {errors.displayName && (
                <p className="mt-1 text-xs text-red-400">{errors.displayName}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
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
                'Create Account'
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-500">Or</span>
            </div>
          </div>

          {showMockGoogle ? (
            <button
              type="button"
              onClick={triggerMockGoogleLogin}
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-800 bg-slate-950 py-3 text-sm font-semibold text-slate-200 transition-all hover:bg-slate-900 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              Continue with Google (Demo)
            </button>
          ) : (
            <div id="google-signin-btn" className="flex justify-center w-full min-h-[44px]" />
          )}

          <div className="mt-6 text-center">
            <span className="text-xs text-slate-500">Already have an account? </span>
            <Link
              href="/login"
              className="text-xs font-semibold text-indigo-400 transition-all hover:text-indigo-300"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
