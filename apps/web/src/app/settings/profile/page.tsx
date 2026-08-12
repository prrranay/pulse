'use client';

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/auth-context';
import { apiClient } from '../../../lib/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, User } from 'lucide-react';
import { z } from 'zod';
import { ApiResponse, User as UserType } from '../../../types';

const profileSchema = z.object({
  displayName: z
    .string()
    .max(50, { message: 'Display name cannot exceed 50 characters' })
    .optional(),
  bio: z
    .string()
    .max(160, { message: 'Bio cannot exceed 160 characters' })
    .optional(),
  avatarUrl: z
    .string()
    .url({ message: 'Please enter a valid URL' })
    .or(z.literal(''))
    .optional(),
});

export default function EditProfilePage() {
  const { user, isLoading, updateUser } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    avatarUrl: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      setForm({
        displayName: user.displayName || '',
        bio: user.bio || '',
        avatarUrl: user.avatarUrl || '',
      });
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: z.infer<typeof profileSchema>) =>
      apiClient.patch<ApiResponse<UserType>>('/users/me', data),
    onSuccess: (res) => {
      updateUser(res.data);
      queryClient.invalidateQueries({ queryKey: ['profile', user?.username] });
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    },
    onError: (err: unknown) => {
      const apiErr = err as { message?: string };
      setSubmitError(apiErr?.message ?? 'Failed to update profile. Please try again.');
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    // Transform empty string to undefined for URL validation
    const payload = {
      displayName: form.displayName,
      bio: form.bio,
      avatarUrl: form.avatarUrl === '' ? undefined : form.avatarUrl,
    };

    const validation = profileSchema.safeParse(payload);
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

    updateProfileMutation.mutate(payload);
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
      {/* Top Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-900 bg-slate-950/80 px-4 py-3 backdrop-blur-md">
        <button
          onClick={() => router.push(`/${user.username}`)}
          className="rounded-full p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-bold text-slate-100">Edit Profile</h2>
      </header>

      <div className="mx-auto max-w-xl px-4 py-8">
        {/* Profile Card Preview */}
        <div className="mb-8 rounded-2xl border border-slate-900 bg-slate-900/20 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border-2 border-indigo-500/20">
              {form.avatarUrl ? (
                <img
                  src={form.avatarUrl}
                  alt="Avatar preview"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '';
                  }}
                />
              ) : (
                <User className="h-8 w-8 text-slate-600" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                {form.displayName || user.username}
              </h3>
              <p className="text-xs text-slate-500">@{user.username}</p>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-xl shadow-2xl">
          {submitError && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {submitError}
            </div>
          )}

          {submitSuccess && (
            <div className="mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-400">
              Profile updated successfully!
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="displayName"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Display Name
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
                htmlFor="bio"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                value={form.bio}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                placeholder="Tell us about yourself..."
              />
              {errors.bio && (
                <p className="mt-1 text-xs text-red-400">{errors.bio}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="avatarUrl"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Avatar Image URL
              </label>
              <input
                id="avatarUrl"
                name="avatarUrl"
                type="text"
                value={form.avatarUrl}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="https://images.unsplash.com/photo-..."
              />
              {errors.avatarUrl && (
                <p className="mt-1 text-xs text-red-400">{errors.avatarUrl}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="relative w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50"
            >
              {updateProfileMutation.isPending ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              ) : (
                'Save Changes'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

