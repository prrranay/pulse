'use client';

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/auth-context';
import { apiClient } from '../../../lib/api-client';
import {
  deleteCloudinaryAsset,
  uploadImageToCloudinary,
  validateImageFile,
} from '../../../lib/cloudinary-upload';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UploadCloud, User, X } from 'lucide-react';
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

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

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
      setUploadedPublicId(null);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const validationError = validateImageFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const previousPublicId = uploadedPublicId;
      const result = await uploadImageToCloudinary(file, {
        onProgress: setUploadProgress,
        onXhrCreated: (xhr) => {
          xhrRef.current = xhr;
        },
      });

      setForm((prev) => ({ ...prev, avatarUrl: result.secureUrl }));
      setUploadedPublicId(result.publicId);
      setUploadProgress(100);
      setErrors((prev) => {
        if (!prev.avatarUrl) return prev;
        const copy = { ...prev };
        delete copy.avatarUrl;
        return copy;
      });

      if (previousPublicId && previousPublicId !== result.publicId) {
        deleteCloudinaryAsset(previousPublicId).catch((err) => {
          console.error('Failed to delete previous temp avatar asset:', err);
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload image.';
      if (message !== 'Upload cancelled.') {
        setUploadError(message);
      }
    } finally {
      xhrRef.current = null;
      setUploading(false);
    }
  };

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const handleRemoveAvatar = async () => {
    const pubId = uploadedPublicId;
    setForm((prev) => ({ ...prev, avatarUrl: '' }));
    setUploadedPublicId(null);
    setUploadProgress(0);
    setUploadError(null);
    if (pubId) {
      try {
        await deleteCloudinaryAsset(pubId);
      } catch (err) {
        console.error('Failed to delete temp avatar asset:', err);
      }
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
                Avatar Image
              </label>

              {uploadError && (
                <div className="mt-2 rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-400">
                  {uploadError}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              {uploading ? (
                <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2.5">
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">Uploading: {uploadProgress}%</p>
                    <button
                      type="button"
                      onClick={cancelUpload}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-950/60 px-4 py-3 text-xs font-medium text-slate-300 hover:border-indigo-500/50 hover:bg-slate-900/60 hover:text-indigo-300 transition-all"
                  >
                    <UploadCloud className="h-4 w-4 text-indigo-400" />
                    <span>{form.avatarUrl ? 'Upload New Photo' : 'Upload Photo (JPG, PNG, WEBP · Max 5MB)'}</span>
                  </button>
                  {form.avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-xs font-medium text-slate-400 hover:border-red-500/30 hover:text-red-400 transition-all"
                      title="Remove Avatar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              <input
                id="avatarUrl"
                name="avatarUrl"
                type="text"
                value={form.avatarUrl}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-slate-300 placeholder-slate-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Or paste an image URL (https://...)"
              />
              {errors.avatarUrl && (
                <p className="mt-1 text-xs text-red-400">{errors.avatarUrl}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={updateProfileMutation.isPending || uploading}
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

