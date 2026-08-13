'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
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
/* eslint-disable react-hooks/set-state-in-effect */

export default function PostCard({ post }: { post: PostResponse }) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Optimistic states
  const [localIsLiked, setLocalIsLiked] = useState(post.isLiked);
  const [localLikesCount, setLocalLikesCount] = useState(post.likesCount);

  const [localIsBookmarked, setLocalIsBookmarked] = useState(post.isBookmarked);

  const [localIsReposted, setLocalIsReposted] = useState(post.isReposted);
  const [localRepostsCount, setLocalRepostsCount] = useState(post.repostsCount);



  const invalidateAllPostFeeds = () => {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['post', post.id] });
    queryClient.invalidateQueries({ queryKey: ['user-posts'] });
    queryClient.invalidateQueries({ queryKey: ['user-reposts'] });
    queryClient.invalidateQueries({ queryKey: ['user-bookmarks'] });
    queryClient.invalidateQueries({ queryKey: ['community-posts'] });
    queryClient.invalidateQueries({ queryKey: ['explore'] });
    queryClient.invalidateQueries({ queryKey: ['search'] });
  };

  // 1. Like mutation
  const likeMutation = useMutation({
    mutationFn: (shouldLike: boolean) =>
      shouldLike
        ? apiClient.post<ApiResponse<unknown>>(`/posts/${post.id}/like`)
        : apiClient.delete<ApiResponse<unknown>>(`/posts/${post.id}/like`),
    onSuccess: () => {
      invalidateAllPostFeeds();
    },
    onError: () => {
      setLocalIsLiked(post.isLiked);
      setLocalLikesCount(post.likesCount);
    },
  });

  // 2. Bookmark mutation
  const bookmarkMutation = useMutation({
    mutationFn: (shouldBookmark: boolean) =>
      shouldBookmark
        ? apiClient.post<ApiResponse<unknown>>(`/posts/${post.id}/bookmark`)
        : apiClient.delete<ApiResponse<unknown>>(`/posts/${post.id}/bookmark`),
    onSuccess: () => {
      invalidateAllPostFeeds();
    },
    onError: () => {
      setLocalIsBookmarked(post.isBookmarked);
    },
  });

  // 3. Repost mutation
  const repostMutation = useMutation({
    mutationFn: (shouldRepost: boolean) =>
      shouldRepost
        ? apiClient.post<ApiResponse<unknown>>(`/posts/${post.id}/repost`)
        : apiClient.delete<ApiResponse<unknown>>(`/posts/${post.id}/repost`),
    onSuccess: () => {
      invalidateAllPostFeeds();
    },
    onError: () => {
      setLocalIsReposted(post.isReposted);
      setLocalRepostsCount(post.repostsCount);
    },
  });

  useEffect(() => {
    if (!likeMutation.isPending) {
      setLocalIsLiked(post.isLiked);
      setLocalLikesCount(post.likesCount);
    }
  }, [post.isLiked, post.likesCount, likeMutation.isPending]);

  useEffect(() => {
    if (!bookmarkMutation.isPending) {
      setLocalIsBookmarked(post.isBookmarked);
    }
  }, [post.isBookmarked, bookmarkMutation.isPending]);

  useEffect(() => {
    if (!repostMutation.isPending) {
      setLocalIsReposted(post.isReposted);
      setLocalRepostsCount(post.repostsCount);
    }
  }, [post.isReposted, post.repostsCount, repostMutation.isPending]);

  // 4. Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: () => apiClient.delete<ApiResponse<unknown>>(`/posts/${post.id}`),
    onSuccess: () => {
      invalidateAllPostFeeds();
    },
  });

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    const nextIsLiked = !localIsLiked;
    const nextLikesCount = nextIsLiked ? localLikesCount + 1 : Math.max(0, localLikesCount - 1);
    setLocalIsLiked(nextIsLiked);
    setLocalLikesCount(nextLikesCount);
    likeMutation.mutate(nextIsLiked);
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    const nextIsBookmarked = !localIsBookmarked;
    setLocalIsBookmarked(nextIsBookmarked);
    bookmarkMutation.mutate(nextIsBookmarked);
  };

  const handleRepost = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    const nextIsReposted = !localIsReposted;
    const nextRepostsCount = nextIsReposted ? localRepostsCount + 1 : Math.max(0, localRepostsCount - 1);
    setLocalIsReposted(nextIsReposted);
    setLocalRepostsCount(nextRepostsCount);
    repostMutation.mutate(nextIsReposted);
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
              {post.moderationStatus === 'PENDING' && (
                <span className="ml-2 inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-500 border border-amber-500/20">
                  Under Review
                </span>
              )}
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
              className={`flex items-center gap-1.5 text-xs transition-all hover:text-emerald-400 ${
                localIsReposted ? 'text-emerald-400 font-semibold' : ''
              }`}
            >
              <Repeat className="h-4.5 w-4.5 transition-transform" />
              <span>{localRepostsCount}</span>
            </button>

            {/* Like Button */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 text-xs transition-all hover:text-rose-500 ${
                localIsLiked ? 'text-rose-500 font-semibold' : ''
              }`}
            >
              <Heart
                className={`h-4.5 w-4.5 transition-all ${
                  localIsLiked ? 'fill-rose-500 stroke-rose-500 scale-110' : ''
                }`}
              />
              <span>{localLikesCount}</span>
            </button>

            {/* Bookmark Button */}
            <button
              onClick={handleBookmark}
              className={`flex items-center gap-1.5 text-xs transition-all hover:text-amber-500 ${
                localIsBookmarked ? 'text-amber-500 font-semibold' : ''
              }`}
            >
              <Bookmark
                className={`h-4.5 w-4.5 ${
                  localIsBookmarked ? 'fill-amber-500 stroke-amber-500' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
