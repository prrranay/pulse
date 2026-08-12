'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../hooks/auth-context';
import {
  ApiResponse,
  ExploreDataResponse,
  SearchResultsResponse,
} from '../../types';
import PostCard from '../../components/post-card';
import { PostSkeleton } from '../../components/skeleton-loader';
import { useRouter } from 'next/navigation';
import {
  Search,
  Users,
  Compass,
  ArrowLeft,
  Plus,
  Flame,
  Sparkles,
} from 'lucide-react';

/* eslint-disable @next/next/no-img-element */

export default function ExplorePage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'trending' | 'recent'>('trending');
  const [searchTab, setSearchTab] = useState<'posts' | 'users' | 'communities'>('posts');

  // Create Community Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [commName, setCommName] = useState('');
  const [commDesc, setCommDesc] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Fetch Explore overview (trending, suggestions)
  const { data: exploreRes, isLoading: exploreLoading } = useQuery<
    ApiResponse<ExploreDataResponse>
  >({
    queryKey: ['explore'],
    queryFn: () => apiClient.get<ApiResponse<ExploreDataResponse>>('/discovery/explore'),
  });

  const exploreData = exploreRes?.data;

  // 2. Fetch Search results
  const { data: searchRes, isLoading: searchLoading } = useQuery<
    ApiResponse<SearchResultsResponse>
  >({
    queryKey: ['search', searchQuery],
    queryFn: () =>
      apiClient.get<ApiResponse<SearchResultsResponse>>(`/discovery/search?q=${searchQuery}`),
    enabled: searchQuery.trim().length > 0,
  });

  const searchData = searchRes?.data;

  // 3. Create Community Mutation
  const createCommunityMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      apiClient.post<ApiResponse<{ id: string }>>('/communities', data),
    onSuccess: (res) => {
      setCommName('');
      setCommDesc('');
      setShowCreateModal(false);
      queryClient.invalidateQueries({ queryKey: ['explore'] });
      // Direct redirect to the new community page
      router.push(`/communities/${res.data.id}`);
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      setErrorMsg(error.response?.data?.message || 'Failed to create community.');
    },
  });

  const handleCreateCommunity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commName.trim() || !commDesc.trim()) return;
    setErrorMsg('');
    createCommunityMutation.mutate({
      name: commName.trim(),
      description: commDesc.trim(),
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Search Header Bar */}
      <header className="sticky top-0 z-10 border-b border-slate-900 bg-slate-950/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto max-w-4xl flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search developers, posts, or communities..."
              className="w-full rounded-full border border-slate-900 bg-slate-900/40 py-2 pl-9 pr-4 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-500/40 transition-all"
            />
          </form>

          {user && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-indigo-500 shadow-md"
            >
              <Plus className="h-3.5 w-3.5" /> Community
            </button>
          )}
        </div>
      </header>

      {/* Main Grid content */}
      <main className="mx-auto max-w-4xl px-4 py-6">
        {searchQuery.trim().length > 0 ? (
          // SEARCH RESULTS VIEW
          <div className="space-y-6">
            <div className="flex border-b border-slate-900 text-sm">
              <button
                onClick={() => setSearchTab('posts')}
                className={`px-4 py-2.5 font-bold transition-all border-b-2 ${
                  searchTab === 'posts'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-200'
                }`}
              >
                Posts
              </button>
              <button
                onClick={() => setSearchTab('users')}
                className={`px-4 py-2.5 font-bold transition-all border-b-2 ${
                  searchTab === 'users'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-200'
                }`}
              >
                Users
              </button>
              <button
                onClick={() => setSearchTab('communities')}
                className={`px-4 py-2.5 font-bold transition-all border-b-2 ${
                  searchTab === 'communities'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-200'
                }`}
              >
                Communities
              </button>
            </div>

            {searchLoading && (
              <div className="space-y-4">
                <PostSkeleton />
                <PostSkeleton />
              </div>
            )}

            {!searchLoading && searchData && (
              <div>
                {/* Posts results */}
                {searchTab === 'posts' && (
                  <div className="space-y-4">
                    {searchData.posts.length === 0 ? (
                      <p className="text-center text-xs text-slate-500 italic py-8">
                        No posts matching &ldquo;{searchQuery}&rdquo;
                      </p>
                    ) : (
                      searchData.posts.map((post) => <PostCard key={post.id} post={post} />)
                    )}
                  </div>
                )}

                {/* Users results */}
                {searchTab === 'users' && (
                  <div className="space-y-3">
                    {searchData.users.length === 0 ? (
                      <p className="text-center text-xs text-slate-500 italic py-8">
                        No developers matching &ldquo;{searchQuery}&rdquo;
                      </p>
                    ) : (
                      searchData.users.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => router.push(`/${item.username}`)}
                          className="flex items-center gap-3 rounded-xl border border-slate-900 bg-slate-900/10 p-3 hover:bg-slate-900/20 cursor-pointer"
                        >
                          <div className="h-9 w-9 shrink-0 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-indigo-500/10">
                            {item.avatarUrl ? (
                              <img
                                src={item.avatarUrl}
                                alt={item.username}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-bold uppercase text-slate-600">
                                {item.username.slice(0, 2)}
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-200">
                              {item.displayName || item.username}
                            </h4>
                            <p className="text-[10px] text-slate-500">@{item.username}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Communities results */}
                {searchTab === 'communities' && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {searchData.communities.length === 0 ? (
                      <p className="col-span-2 text-center text-xs text-slate-500 italic py-8">
                        No communities matching &ldquo;{searchQuery}&rdquo;
                      </p>
                    ) : (
                      searchData.communities.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => router.push(`/communities/${item.id}`)}
                          className="rounded-xl border border-slate-900 bg-slate-900/20 p-4 hover:border-slate-800 transition-all cursor-pointer"
                        >
                          <h4 className="text-xs font-bold text-indigo-400 hover:underline">
                            c/{item.name}
                          </h4>
                          <p className="mt-1 text-[10px] text-slate-400 line-clamp-2">
                            {item.description}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // EXPLORE OVERVIEW (Trending, suggestions, communities)
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Left Feed section */}
            <div className="md:col-span-2 space-y-6">
              {/* Tab Selector */}
              <div className="flex border-b border-slate-900 text-sm">
                <button
                  onClick={() => setActiveTab('trending')}
                  className={`flex items-center gap-1.5 px-4 py-2.5 font-bold transition-all border-b-2 ${
                    activeTab === 'trending'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-200'
                  }`}
                >
                  <Flame className="h-4 w-4 text-orange-500" /> Trending
                </button>
                <button
                  onClick={() => setActiveTab('recent')}
                  className={`flex items-center gap-1.5 px-4 py-2.5 font-bold transition-all border-b-2 ${
                    activeTab === 'recent'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-200'
                  }`}
                >
                  <Compass className="h-4 w-4 text-indigo-400" /> Recent
                </button>
              </div>

              {exploreLoading && (
                <div className="space-y-4">
                  <PostSkeleton />
                  <PostSkeleton />
                </div>
              )}

              {!exploreLoading && exploreData && (
                <div className="space-y-4">
                  {activeTab === 'trending' ? (
                    exploreData.trendingPosts.length === 0 ? (
                      <p className="text-center text-xs text-slate-500 italic py-8">
                        No trending posts today.
                      </p>
                    ) : (
                      exploreData.trendingPosts.map((post) => (
                        <PostCard key={post.id} post={post} />
                      ))
                    )
                  ) : exploreData.recentPosts.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 italic py-8">
                      No recent posts.
                    </p>
                  ) : (
                    exploreData.recentPosts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Right sidebar widgets */}
            <div className="space-y-6">
              {/* Popular Communities widget */}
              {!exploreLoading && exploreData && (
                <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-5 backdrop-blur-md space-y-4">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Users className="h-4 w-4 text-indigo-400" /> Communities
                  </h3>
                  <div className="space-y-3">
                    {exploreData.popularCommunities.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => router.push(`/communities/${item.id}`)}
                        className="group block rounded-lg border border-slate-900 bg-slate-950/40 p-3 hover:border-slate-800 transition-all cursor-pointer"
                      >
                        <h4 className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition-all">
                          c/{item.name}
                        </h4>
                        <p className="text-[10px] text-slate-500">
                          {item.memberCount} members
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested developers widget */}
              {!exploreLoading && exploreData && (
                <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-5 backdrop-blur-md space-y-4">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Sparkles className="h-4 w-4 text-emerald-400" /> Who to follow
                  </h3>
                  <div className="space-y-3">
                    {exploreData.suggestedUsers.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => router.push(`/${item.username}`)}
                        className="flex items-center justify-between rounded-lg border border-slate-900 bg-slate-950/40 p-2.5 hover:border-slate-800 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-indigo-500/10">
                            {item.avatarUrl ? (
                              <img
                                src={item.avatarUrl}
                                alt={item.username}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] font-bold uppercase text-slate-600">
                                {item.username.slice(0, 2)}
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-[10px] font-bold text-slate-200 truncate max-w-24">
                              {item.displayName || item.username}
                            </h4>
                            <p className="text-[8px] text-slate-500">@{item.username}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* CREATE COMMUNITY DIALOG MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-xl border border-slate-900 bg-slate-950 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" /> Create Community
            </h3>
            <p className="text-xs text-slate-500">
              Launch a community hub. Names cannot contain spaces and must be unique.
            </p>

            <form onSubmit={handleCreateCommunity} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Name</label>
                <input
                  type="text"
                  value={commName}
                  onChange={(e) => setCommName(e.target.value)}
                  placeholder="e.g. rust-developers"
                  className="w-full rounded-lg border border-slate-900 bg-slate-900/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Description</label>
                <textarea
                  value={commDesc}
                  onChange={(e) => setCommDesc(e.target.value)}
                  placeholder="What is this community for? Share guidelines and topics..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-900 bg-slate-900/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              {errorMsg && <p className="text-xs font-semibold text-red-400">{errorMsg}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCommName('');
                    setCommDesc('');
                    setErrorMsg('');
                  }}
                  className="rounded-lg border border-slate-800 bg-slate-900/20 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-900 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!commName.trim() || !commDesc.trim() || createCommunityMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-all disabled:opacity-50"
                >
                  {createCommunityMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
