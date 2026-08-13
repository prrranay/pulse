'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/auth-context';
import { apiClient } from '../../../lib/api-client';
import {
  ApiResponse,
  CommunityDetailsResponse,
  PostResponse,
} from '../../../types';
import PostCard from '../../../components/post-card';
import PostComposer from '../../../components/post-composer';
import { PostSkeleton } from '../../../components/skeleton-loader';
import { ArrowLeft, Users, Calendar, DoorOpen, LogOut } from 'lucide-react';

export default function CommunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const id = params.id as string;

  // 1. Fetch Community Details
  const {
    data: detailsRes,
    isLoading: detailsLoading,
    error: detailsError,
  } = useQuery<ApiResponse<CommunityDetailsResponse>>({
    queryKey: ['community', id],
    queryFn: () =>
      apiClient.get<ApiResponse<CommunityDetailsResponse>>(`/communities/${id}`),
    enabled: !!id,
  });

  const community = detailsRes?.data;

  // 2. Fetch Community Posts
  const { data: postsRes, isLoading: postsLoading } = useQuery<
    ApiResponse<PostResponse[]>
  >({
    queryKey: ['community-posts', id],
    queryFn: () => apiClient.get<ApiResponse<PostResponse[]>>(`/communities/${id}/posts`),
    enabled: !!id,
  });

  const posts = postsRes?.data ?? [];

  // 3. Join community mutation
  const joinMutation = useMutation({
    mutationFn: () => apiClient.post<ApiResponse<unknown>>(`/communities/${id}/join`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', id] });
      queryClient.invalidateQueries({ queryKey: ['explore'] });
    },
  });

  // 4. Leave community mutation
  const leaveMutation = useMutation({
    mutationFn: () => apiClient.delete<ApiResponse<unknown>>(`/communities/${id}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', id] });
      queryClient.invalidateQueries({ queryKey: ['explore'] });
    },
  });

  const handleJoinToggle = () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (community?.isMember) {
      if (community.role === 'OWNER') {
        alert('As the owner, you cannot leave this community.');
        return;
      }
      if (confirm('Are you sure you want to leave this community?')) {
        leaveMutation.mutate();
      }
    } else {
      joinMutation.mutate();
    }
  };

  if (detailsLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <PostSkeleton />
        </div>
      </div>
    );
  }

  if (detailsError || !community) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
        <h2 className="text-xl font-bold">Community Not Found</h2>
        <p className="mt-2 text-sm text-slate-500">
          This community may have been deleted or the link is incorrect.
        </p>
        <button
          onClick={() => router.push('/explore')}
          className="mt-6 flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-all"
        >
          <ArrowLeft className="h-4 w-4" /> Go back to Explore
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Hero Community Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-950 to-purple-950 border-b border-slate-900 py-8 px-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-100 sm:text-3xl">
                c/{community.name}
              </h1>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                {community.description}
              </p>
            </div>

            <button
              onClick={handleJoinToggle}
              disabled={joinMutation.isPending || leaveMutation.isPending}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold shadow-md transition-all ${
                community.isMember
                  ? 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              }`}
            >
              {community.isMember ? (
                <>
                  <LogOut className="h-3.5 w-3.5" /> Leave
                </>
              ) : (
                <>
                  <DoorOpen className="h-3.5 w-3.5" /> Join Hub
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {community.memberCount} members
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Created{' '}
              {new Date(community.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Scoped Feed Feed */}
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Composer (visible only to members) */}
        {community.isMember ? (
          <PostComposer communityId={community.id} />
        ) : (
          <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-4 text-center">
            <p className="text-xs text-slate-500 italic">
              Join this community hub to post and share code.
            </p>
          </div>
        )}

        {/* Community Posts */}
        {postsLoading ? (
          <div className="space-y-4">
            <PostSkeleton />
            <PostSkeleton />
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-12 text-center">
            <p className="text-sm font-semibold text-slate-400">All quiet here.</p>
            <p className="mt-1 text-xs text-slate-600">
              No posts have been shared in this community yet. Be the first!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

