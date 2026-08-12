'use client';

import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/auth-context';
import { apiClient } from '../lib/api-client';
import { PostResponse, ApiResponse } from '../types';
import PostComposer from '../components/post-composer';
import PostCard from '../components/post-card';
import { PostSkeleton } from '../components/skeleton-loader';
import Link from 'next/link';
import { Flame, LogIn, UserPlus, Sparkles } from 'lucide-react';

interface FeedResponse {
  items: PostResponse[];
  nextCursor: string | null;
}

export default function HomePage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch Infinite Feed
  const {
    data,
    isLoading: feedLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error,
  } = useInfiniteQuery<ApiResponse<FeedResponse>>({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) =>
      apiClient.get<ApiResponse<FeedResponse>>(`/posts/feed?limit=10${
        pageParam ? `&cursor=${pageParam}` : ''
      }`),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.data.nextCursor,
    enabled: !!user, // Feed is private/guarded by API
  });

  // 2. Setup IntersectionObserver for Infinite Scrolling
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.8 },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle loading states
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  // Guest landing screen if not logged in
  if (!user) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 text-slate-100">
        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-indigo-500/10 blur-[90px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-[100px]" />

        <div className="relative max-w-2xl text-center space-y-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/5 px-4 py-1.5 text-xs font-semibold text-indigo-400 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" /> Introducing Pulse
          </div>

          <h1 className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl">
            The Stream for Developers
          </h1>
          <p className="mx-auto max-w-lg text-sm text-slate-400 sm:text-base leading-relaxed">
            Pulse is a production-oriented technical social feed. Share code, track updates, follow developers, and join the engineering conversation.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold hover:bg-indigo-500 transition-all shadow-lg"
            >
              <LogIn className="h-4 w-4" /> Sign In
            </Link>
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-6 py-3 text-sm font-semibold hover:bg-slate-800 hover:text-white transition-all backdrop-blur-md"
            >
              <UserPlus className="h-4 w-4" /> Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const posts = data?.pages.flatMap((page) => page.data.items) ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-10 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-xl font-black tracking-wider text-transparent"
          >
            Pulse
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href={`/${user.username}`}
              className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all"
            >
              @{user.username}
            </Link>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-900 bg-slate-900/50 hover:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Main Feed Column */}
          <div className="md:col-span-2 space-y-6">
            {/* Composer */}
            <PostComposer />

            {/* Error view */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
                <p className="text-xs text-red-400">Failed to load feed posts.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 text-xs font-semibold text-indigo-400 underline"
                >
                  Reload
                </button>
              </div>
            )}

            {/* Empty feed state */}
            {!feedLoading && posts.length === 0 && (
              <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-12 text-center">
                <p className="text-sm font-semibold text-slate-400">Your feed is empty.</p>
                <p className="mt-1 text-xs text-slate-600">
                  Write your first post or follow some developers to start seeing updates!
                </p>
              </div>
            )}

            {/* Feed Cards list */}
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {/* Loading skeletons */}
            {(feedLoading || isFetchingNextPage) && (
              <div className="space-y-4">
                <PostSkeleton />
                <PostSkeleton />
              </div>
            )}

            {/* Infinite scroll sentinel */}
            {hasNextPage && <div ref={sentinelRef} className="h-10" />}
          </div>

          {/* Sidebar Widgets Column */}
          <div className="hidden md:block space-y-6">
            {/* Quick Profile widget */}
            <div className="rounded-xl border border-slate-900 bg-slate-900/25 p-5 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-indigo-500/10">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-base font-bold uppercase text-slate-600">
                      {user.username.slice(0, 2)}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">
                    {user.displayName || user.username}
                  </h3>
                  <p className="text-xs text-slate-500">@{user.username}</p>
                </div>
              </div>
              <Link
                href={`/${user.username}`}
                className="mt-4 block w-full rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 py-2 text-center text-xs font-semibold text-indigo-400 transition-all"
              >
                View Profile
              </Link>
            </div>

            {/* Pulse Trends widgets */}
            <div className="rounded-xl border border-slate-900 bg-slate-900/25 p-5 backdrop-blur-md space-y-4">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Flame className="h-4 w-4 text-orange-500" /> Pulse Trends
              </h3>

              <div className="space-y-3 text-xs">
                <div className="rounded-lg border border-slate-900 bg-slate-950/40 p-2.5">
                  <span className="font-bold text-indigo-400 hover:underline cursor-pointer">
                    #nextjs15
                  </span>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    84 developers posting
                  </p>
                </div>
                <div className="rounded-lg border border-slate-900 bg-slate-950/40 p-2.5">
                  <span className="font-bold text-indigo-400 hover:underline cursor-pointer">
                    #typescript
                  </span>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    142 developers posting
                  </p>
                </div>
                <div className="rounded-lg border border-slate-900 bg-slate-950/40 p-2.5">
                  <span className="font-bold text-indigo-400 hover:underline cursor-pointer">
                    #prisma
                  </span>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    32 developers posting
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
