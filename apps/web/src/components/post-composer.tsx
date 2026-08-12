'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../hooks/auth-context';
import { Image as ImageIcon, Send } from 'lucide-react';
import { ApiResponse } from '../types';

export default function PostComposer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);

  const createPostMutation = useMutation({
    mutationFn: (data: { content: string; imageUrl?: string }) =>
      apiClient.post<ApiResponse<unknown>>('/posts', data),
    onSuccess: () => {
      setContent('');
      setImageUrl('');
      setShowImageInput(false);
      // Invalidate feed query to reload feed posts automatically
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    createPostMutation.mutate({
      content: content.trim(),
      imageUrl: imageUrl.trim() === '' ? undefined : imageUrl.trim(),
    });
  };

  if (!user) return null;

  return (
    <div className="rounded-xl border border-slate-900 bg-slate-900/40 p-4 backdrop-blur-xl">
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
              rows={3}
              className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-600 outline-none resize-none"
            />
          </div>
        </div>

        {/* Dynamic Image input block */}
        {showImageInput && (
          <div className="ml-13 rounded-lg border border-slate-800 bg-slate-950 p-2 transition-all">
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Enter image URL (e.g. https://images.unsplash.com/...)"
              className="w-full bg-transparent px-2 py-1.5 text-xs text-slate-200 outline-none placeholder-slate-700"
            />
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
            disabled={!content.trim() || createPostMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-indigo-500 disabled:pointer-events-none disabled:opacity-50"
          >
            {createPostMutation.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Send className="h-3 w-3" /> Post
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
