'use client';

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../hooks/auth-context';
import { Image as ImageIcon, Send, Sparkles } from 'lucide-react';
import { ApiResponse, PostResponse } from '../types';

export default function PostComposer({
  communityId,
  editingPost,
  onComplete,
}: {
  communityId?: string;
  editingPost?: PostResponse;
  onComplete?: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState(editingPost?.content ?? '');
  const [imageUrl, setImageUrl] = useState(editingPost?.imageUrl ?? '');
  const [imagePublicId, setImagePublicId] = useState(editingPost?.imagePublicId ?? '');
  const [showImageInput, setShowImageInput] = useState(!!editingPost?.imageUrl);
  const [refiningTone, setRefiningTone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // 1. Post Creation/Edit Mutation
  const postMutation = useMutation({
    mutationFn: (data: { content: string; imageUrl?: string | null; imagePublicId?: string | null; communityId?: string }) => {
      if (editingPost) {
        return apiClient.patch<ApiResponse<unknown>>(`/posts/${editingPost.id}`, {
          content: data.content,
          imageUrl: data.imageUrl,
          imagePublicId: data.imagePublicId,
        });
      }
      return apiClient.post<ApiResponse<unknown>>('/posts', data);
    },
    onSuccess: () => {
      if (!editingPost) {
        setContent('');
        setImageUrl('');
        setImagePublicId('');
        setUploadProgress(0);
        setUploadError(null);
        setShowImageInput(false);
      }
      // Invalidate feed and community-specific query cache keys
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-posts'] });
      queryClient.invalidateQueries({ queryKey: ['user-reposts'] });
      queryClient.invalidateQueries({ queryKey: ['user-bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['explore'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      if (editingPost) {
        queryClient.invalidateQueries({ queryKey: ['post', editingPost.id] });
      }
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: ['community-posts', communityId] });
      }
      onComplete?.();
    },
    onError: (err: unknown) => {
      const errorObj = err as { message?: string } | null;
      setError(errorObj?.message ?? 'Failed to save post. Please try again.');
    },
  });

  // 2. AI Refine Mutation
  const refineMutation = useMutation({
    mutationFn: (data: { text: string; tone: 'improve' | 'concise' | 'professional' | 'engaging' }) =>
      apiClient.post<{ refined: string }>('/ai/refine', data),
    onSuccess: (res) => {
      setContent(res.refined);
      setRefiningTone(null);
      setError(null);
    },
    onError: (err: unknown) => {
      setRefiningTone(null);
      const errorObj = err as { message?: string } | null;
      setError(errorObj?.message ?? 'AI refinement failed. Please try again.');
    },
  });

  const handleRefine = (tone: 'improve' | 'concise' | 'professional' | 'engaging') => {
    if (!content.trim() || refineMutation.isPending) return;
    setRefiningTone(tone);
    refineMutation.mutate({ text: content.trim(), tone });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Only JPG, PNG, and WEBP are supported.');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setUploadError('Image size exceeds 5MB limit.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const res = await apiClient.post<ApiResponse<{
        signature: string;
        timestamp: number;
        folder: string;
        apiKey: string;
        cloudName: string;
      }>>('/cloudinary/signature');
      const sigData = res.data;

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.open('POST', `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setImageUrl(response.secure_url);
          setImagePublicId(response.public_id);
          setUploadProgress(100);
          setUploading(false);
        } else {
          setUploadError('Upload failed. Please try again.');
          setUploading(false);
        }
      };

      xhr.onerror = () => {
        setUploadError('Network error during upload.');
        setUploading(false);
      };

      const formData = new FormData();
      formData.append('file', file);
      formData.append('signature', sigData.signature);
      formData.append('timestamp', String(sigData.timestamp));
      formData.append('folder', sigData.folder);
      formData.append('api_key', sigData.apiKey);

      xhr.send(formData);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setUploadError(apiErr?.message ?? 'Failed to initialize upload signature.');
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

  const handleRemoveImage = async () => {
    const pubId = imagePublicId;
    setImageUrl('');
    setImagePublicId('');
    setUploadProgress(0);
    setUploadError(null);
    const isNewUpload = editingPost ? pubId !== editingPost.imagePublicId : true;
    if (pubId && isNewUpload) {
      try {
        await apiClient.post('/cloudinary/delete', { publicId: pubId });
      } catch (err) {
        console.error('Failed to delete temp upload asset:', err);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    postMutation.mutate({
      content: content.trim(),
      imageUrl: imageUrl.trim() === '' ? null : imageUrl.trim(),
      imagePublicId: imagePublicId.trim() === '' ? null : imagePublicId.trim(),
      communityId,
    });
  };

  if (!user) return null;

  return (
    <div className={editingPost ? "space-y-4 w-full" : "rounded-xl border border-slate-900 bg-slate-900/40 p-4 backdrop-blur-xl space-y-4"}>
      {error && (
        <div className="flex items-center justify-between rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 font-bold ml-2 text-sm"
          >
            ×
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* User avatar + Text input */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-indigo-500/20">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '';
                }}
              />
            ) : (
              <span className="text-sm font-bold uppercase text-slate-600">
                {user.username.slice(0, 2)}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind? Share your code, ideas, or updates..."
              rows={editingPost ? 5 : 3}
              className="w-full rounded-xl border border-slate-900 bg-slate-950/40 p-3.5 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none shadow-inner"
            />
          </div>
        </div>

        {/* Dynamic Image selector and preview dropzone */}
        {showImageInput && (
          <div className="ml-13 space-y-3">
            {uploadError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-400">
                {uploadError}
              </div>
            )}

            {!imageUrl && !uploading && (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/40 hover:bg-slate-900/40 hover:border-indigo-500/50 cursor-pointer transition-all">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ImageIcon className="w-8 h-8 text-slate-500 mb-2 transition-all hover:scale-110" />
                  <p className="text-xs text-slate-400 font-medium">
                    Drag & drop or <span className="text-indigo-400">browse</span>
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    PNG, JPG, or WEBP (Max 5MB)
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            )}

            {uploading && (
              <div className="flex flex-col items-center justify-center w-full h-32 border border-slate-800 rounded-xl bg-slate-950/40 p-4">
                <div className="w-full bg-slate-800 rounded-full h-1.5 mb-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">Uploading: {uploadProgress}%</p>
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            )}

            {imageUrl && (
              <div className="relative rounded-xl border border-slate-850 overflow-hidden bg-slate-950">
                <img
                  src={imageUrl}
                  alt="Upload preview"
                  className="w-full max-h-60 object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-slate-300 hover:bg-black/90 hover:text-white transition-all"
                  title="Remove Image"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* AI Assistant Refine Toolbar (visible when text is entered) */}
        {content.trim().length > 0 && (
          <div className="ml-13 flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-900 bg-slate-950/30 p-2 transition-all">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400 mr-1.5">
              <Sparkles className="h-3 w-3" /> AI Refine:
            </span>
            <button
              type="button"
              onClick={() => handleRefine('improve')}
              disabled={refineMutation.isPending}
              className={`rounded px-2 py-1 text-[10px] font-medium border border-slate-900 bg-slate-900/40 text-slate-300 hover:border-slate-800 transition-all ${
                refiningTone === 'improve' ? 'animate-pulse text-indigo-400 border-indigo-500/20 bg-indigo-500/5' : ''
              }`}
            >
              {refiningTone === 'improve' ? 'Improving...' : 'Improve'}
            </button>
            <button
              type="button"
              onClick={() => handleRefine('concise')}
              disabled={refineMutation.isPending}
              className={`rounded px-2 py-1 text-[10px] font-medium border border-slate-900 bg-slate-900/40 text-slate-300 hover:border-slate-800 transition-all ${
                refiningTone === 'concise' ? 'animate-pulse text-indigo-400 border-indigo-500/20 bg-indigo-500/5' : ''
              }`}
            >
              {refiningTone === 'concise' ? 'Shortening...' : 'Concise'}
            </button>
            <button
              type="button"
              onClick={() => handleRefine('professional')}
              disabled={refineMutation.isPending}
              className={`rounded px-2 py-1 text-[10px] font-medium border border-slate-900 bg-slate-900/40 text-slate-300 hover:border-slate-800 transition-all ${
                refiningTone === 'professional' ? 'animate-pulse text-indigo-400 border-indigo-500/20 bg-indigo-500/5' : ''
              }`}
            >
              {refiningTone === 'professional' ? 'Polishing...' : 'Professional'}
            </button>
            <button
              type="button"
              onClick={() => handleRefine('engaging')}
              disabled={refineMutation.isPending}
              className={`rounded px-2 py-1 text-[10px] font-medium border border-slate-900 bg-slate-900/40 text-slate-300 hover:border-slate-800 transition-all ${
                refiningTone === 'engaging' ? 'animate-pulse text-indigo-400 border-indigo-500/20 bg-indigo-500/5' : ''
              }`}
            >
              {refiningTone === 'engaging' ? 'Boosting...' : 'Engaging'}
            </button>
          </div>
        )}

        {/* Toolbar Footer */}
        <div className="ml-13 flex items-center justify-between border-t border-slate-900 pt-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowImageInput(!showImageInput)}
              className={`rounded-full p-2 text-slate-400 hover:bg-slate-900 hover:text-indigo-400 transition-all ${
                showImageInput ? 'bg-slate-900 text-indigo-400' : ''
              }`}
              title="Add Image"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
          </div>

          <button
            type="submit"
            disabled={!content.trim() || postMutation.isPending || refineMutation.isPending || uploading}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-indigo-500 disabled:pointer-events-none disabled:opacity-50"
          >
            {postMutation.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Send className="h-3 w-3" /> {editingPost ? 'Save Changes' : 'Post'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
