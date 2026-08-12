'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../hooks/auth-context';
import { Image as ImageIcon, Send, Sparkles } from 'lucide-react';
import { ApiResponse } from '../types';

export default function PostComposer({ communityId }: { communityId?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [refiningTone, setRefiningTone] = useState<string | null>(null);

  // 1. Post Creation Mutation
  const createPostMutation = useMutation({
    mutationFn: (data: { content: string; imageUrl?: string; communityId?: string }) =>
      apiClient.post<ApiResponse<unknown>>('/posts', data),
    onSuccess: () => {
      setContent('');
      setImageUrl('');
      setShowImageInput(false);
      // Invalidate feed and community-specific query cache keys
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: ['community-posts', communityId] });
      }
    },
  });

  // 2. AI Refine Mutation
  const refineMutation = useMutation({
    mutationFn: (data: { text: string; tone: 'improve' | 'concise' | 'professional' | 'engaging' }) =>
      apiClient.post<{ refined: string }>('/ai/refine', data),
    onSuccess: (res) => {
      setContent(res.refined);
      setRefiningTone(null);
    },
    onError: () => {
      setRefiningTone(null);
      alert('AI refinement failed. Please try again.');
    },
  });

  const handleRefine = (tone: 'improve' | 'concise' | 'professional' | 'engaging') => {
    if (!content.trim() || refineMutation.isPending) return;
    setRefiningTone(tone);
    refineMutation.mutate({ text: content.trim(), tone });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    createPostMutation.mutate({
      content: content.trim(),
      imageUrl: imageUrl.trim() === '' ? undefined : imageUrl.trim(),
      communityId,
    });
  };

  if (!user) return null;

  return (
    <div className="rounded-xl border border-slate-900 bg-slate-900/40 p-4 backdrop-blur-xl space-y-4">
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
            disabled={!content.trim() || createPostMutation.isPending || refineMutation.isPending}
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
