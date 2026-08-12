'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/auth-context';
import { apiClient } from '../lib/api-client';
import { PostResponse, ApiResponse } from '../types';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Repeat,
  Trash2,
  Calendar,
} from 'lucide-react';

/* eslint-disable @next/next/no-img-element */

export default function PostCard({ post }: { post: PostResponse }) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // 1. Like mutation
  const likeMutation = useMutation({
    mutationFn: () =>
      post.isLiked
        ? apiClient.delete<ApiResponse<unknown>>(`/posts/${post.id}/like`)
        : apiClient.post<ApiResponse<unknown>>(`/posts/${post.id}/like`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', post.id] });
    },
  });

  // 2. Bookmark mutation
  const bookmarkMutation = useMutation({
    mutationFn: () =>
      post.isBookmarked
        ? apiClient.delete<ApiResponse<unknown>>(`/posts/${post.id}/bookmark`)
        : apiClient.post<ApiResponse<unknown>>(`/posts/${post.id}/bookmark`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', post.id] });
    },
  });

  // 3. Repost mutation
  const repostMutation = useMutation({
    mutationFn: () =>
      post.isReposted
        ? apiClient.delete<ApiResponse<unknown>>(`/posts/${post.id}/repost`)
        : apiClient.post<ApiResponse<unknown>>(`/posts/${post.id}/repost`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', post.id] });
    },
  });

  // 4. Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: () => apiClient.delete<ApiResponse<unknown>>(`/posts/${post.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    likeMutation.mutate();
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    bookmarkMutation.mutate();
  };

  const handleRepost = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    repostMutation.mutate();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this post?')) {
      deletePostMutation.mutate();
    }
  };

  const isAuthor = currentUser && currentUser.id === post.author.id;

  return (
    <div
      onClick={() => router.push(`/posts/${post.id}`)}
      className="group rounded-xl border border-slate-900 bg-slate-900/20 p-5 backdrop-blur-xl shadow-md transition-all hover:border-slate-800 hover:bg-slate-900/30 cursor-pointer"
    >
      <div className="flex items-start gap-3">
        {/* Author Avatar */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/${post.author.username}`);
          }}
          className="h-10 w-10 shrink-0 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-indigo-500/10 cursor-pointer"
        >
          {post.author.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt={post.author.username}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold uppercase text-slate-600">
              {post.author.username.slice(0, 2)}
            </span>
          )}
        </div>

        {/* Content Section */}
        <div className="min-w-0 flex-1">
          {/* Header (Author + date + delete button) */}
          <div className="flex items-center justify-between">
            <div
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/${post.author.username}`);
              }}
              className="flex flex-wrap items-baseline gap-1 cursor-pointer"
            >
              <span className="text-sm font-bold text-slate-200 hover:underline">
                {post.author.displayName || post.author.username}
              </span>
              <span className="text-xs text-slate-500">@{post.author.username}</span>
              <span className="text-xs text-slate-600">·</span>
              <span className="flex items-center gap-1 text-[10px] text-slate-600">
                <Calendar className="h-2.5 w-2.5" />
                {new Date(post.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>

            {isAuthor && (
              <button
                onClick={handleDelete}
                disabled={deletePostMutation.isPending}
                className="rounded-lg p-1.5 text-slate-600 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all disabled:pointer-events-none"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Text Content */}
          <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {post.content}
          </p>

          {/* Image Attachment */}
          {post.imageUrl && (
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-900 bg-slate-950/40">
              <img
                src={post.imageUrl}
                alt="Attachment"
                className="max-h-72 w-full object-cover"
              />
            </div>
          )}

          {/* Interaction Toolbar */}
          <div className="mt-4 flex items-center justify-between text-slate-500">
            {/* Comment Button */}
            <button
              onClick={() => router.push(`/posts/${post.id}`)}
              className="flex items-center gap-1.5 text-xs transition-all hover:text-indigo-400"
            >
              <MessageCircle className="h-4.5 w-4.5" />
              <span>{post.commentsCount}</span>
            </button>

            {/* Repost Button */}
            <button
              onClick={handleRepost}
              disabled={repostMutation.isPending}
              className={`flex items-center gap-1.5 text-xs transition-all hover:text-emerald-400 disabled:opacity-50 ${
                post.isReposted ? 'text-emerald-400 font-semibold' : ''
              }`}
            >
              <Repeat className={`h-4.5 w-4.5 transition-transform ${repostMutation.isPending ? 'animate-spin' : ''}`} />
              <span>{post.repostsCount}</span>
            </button>

            {/* Like Button */}
            <button
              onClick={handleLike}
              disabled={likeMutation.isPending}
              className={`flex items-center gap-1.5 text-xs transition-all hover:text-rose-500 disabled:opacity-50 ${
                post.isLiked ? 'text-rose-500 font-semibold' : ''
              }`}
            >
              <Heart
                className={`h-4.5 w-4.5 transition-all ${
                  post.isLiked ? 'fill-rose-500 stroke-rose-500 scale-110' : ''
                } ${likeMutation.isPending ? 'scale-90 opacity-70' : ''}`}
              />
              <span>{post.likesCount}</span>
            </button>

            {/* Bookmark Button */}
            <button
              onClick={handleBookmark}
              disabled={bookmarkMutation.isPending}
              className={`flex items-center gap-1.5 text-xs transition-all hover:text-amber-500 disabled:opacity-50 ${
                post.isBookmarked ? 'text-amber-500 font-semibold' : ''
              }`}
            >
              <Bookmark
                className={`h-4.5 w-4.5 ${
                  post.isBookmarked ? 'fill-amber-500 stroke-amber-500' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
