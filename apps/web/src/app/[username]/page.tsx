'use client';

/* eslint-disable @next/next/no-img-element */

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/auth-context';
import { apiClient } from '../../lib/api-client';
import { ApiResponse } from '../../types';
import {
  Settings,
  Calendar,
  UserCheck,
  UserPlus,
  ArrowLeft,
} from 'lucide-react';

interface ProfileData {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  followersCount: number;
  followingCount: number;
  postCount: number;
  isFollowing?: boolean;
}

interface FollowUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isFollowing?: boolean;
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const username = params.username as string;

  const [activeTab, setActiveTab] = useState<'followers' | 'following' | null>(null);

  // 1. Fetch User Profile
  const {
    data: profileRes,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery<ApiResponse<ProfileData>>({
    queryKey: ['profile', username],
    queryFn: () => apiClient.get<ApiResponse<ProfileData>>(`/users/${username}`),
    enabled: !!username,
  });

  const profile = profileRes?.data;

  // 2. Fetch Followers List
  const { data: followersRes, isLoading: followersLoading } = useQuery<
    ApiResponse<FollowUser[]>
  >({
    queryKey: ['followers', profile?.id],
    queryFn: () => apiClient.get<ApiResponse<FollowUser[]>>(`/users/${profile?.id}/followers`),
    enabled: !!profile?.id && activeTab === 'followers',
  });

  // 3. Fetch Following List
  const { data: followingRes, isLoading: followingLoading } = useQuery<
    ApiResponse<FollowUser[]>
  >({
    queryKey: ['following', profile?.id],
    queryFn: () => apiClient.get<ApiResponse<FollowUser[]>>(`/users/${profile?.id}/following`),
    enabled: !!profile?.id && activeTab === 'following',
  });

  // 4. Follow Mutation
  const followMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.post<ApiResponse<{ message: string }>>(`/users/${userId}/follow`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      if (profile?.id) {
        queryClient.invalidateQueries({ queryKey: ['followers', profile.id] });
        queryClient.invalidateQueries({ queryKey: ['following', profile.id] });
      }
    },
  });

  // 5. Unfollow Mutation
  const unfollowMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete<ApiResponse<{ message: string }>>(`/users/${userId}/follow`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      if (profile?.id) {
        queryClient.invalidateQueries({ queryKey: ['followers', profile.id] });
        queryClient.invalidateQueries({ queryKey: ['following', profile.id] });
      }
    },
  });

  const isOwnProfile = currentUser && profile && currentUser.id === profile.id;

  const handleFollowAction = () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (!profile) return;

    if (profile.isFollowing) {
      unfollowMutation.mutate(profile.id);
    } else {
      followMutation.mutate(profile.id);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-200">Profile Not Found</h2>
        <p className="mt-2 text-sm text-slate-500">
          The user @{username} doesn&apos;t exist or has deactivated their account.
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-6 flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-all"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Feed
        </button>
      </div>
    );
  }

  const followers = followersRes?.data ?? [];
  const following = followingRes?.data ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              {profile.displayName || profile.username}
            </h2>
            <p className="text-xs text-slate-500">{profile.postCount} posts</p>
          </div>
        </div>
        {isOwnProfile && (
          <button
            onClick={() => router.push('/settings/profile')}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all"
          >
            <Settings className="h-5 w-5" />
          </button>
        )}
      </header>

      {/* Decorative Banner Background */}
      <div className="h-32 w-full bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-900" />

      {/* Main Profile Info */}
      <div className="relative px-4">
        {/* Avatar Placement */}
        <div className="absolute -top-12 left-4 h-24 w-24 rounded-full border-4 border-slate-950 bg-slate-900 overflow-hidden shadow-xl flex items-center justify-center">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.username}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-2xl font-bold uppercase text-slate-600">
              {profile.username.slice(0, 2)}
            </div>
          )}
        </div>

        {/* Action Button Area */}
        <div className="flex justify-end pt-3">
          {isOwnProfile ? (
            <button
              onClick={() => router.push('/settings/profile')}
              className="rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 transition-all"
            >
              Edit Profile
            </button>
          ) : (
            <button
              onClick={handleFollowAction}
              disabled={followMutation.isPending || unfollowMutation.isPending}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                profile.isFollowing
                  ? 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              }`}
            >
              {profile.isFollowing ? (
                <>
                  <UserCheck className="h-3.5 w-3.5" /> Following
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" /> Follow
                </>
              )}
            </button>
          )}
        </div>

        {/* Name and Handle */}
        <div className="mt-4">
          <h1 className="text-xl font-bold text-slate-100">
            {profile.displayName || profile.username}
          </h1>
          <p className="text-sm text-slate-500">@{profile.username}</p>
        </div>

        {/* Bio */}
        {profile.bio && <p className="mt-3 text-sm text-slate-300">{profile.bio}</p>}

        {/* Meta Stats (e.g., Join Date) */}
        <div className="mt-4 flex flex-wrap gap-y-2 gap-x-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Joined {new Date(profile.createdAt).toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric',
            })}
          </div>
        </div>

        {/* Follower / Following Count Badges */}
        <div className="mt-4 flex items-center gap-6 border-b border-slate-900 pb-4 text-sm">
          <button
            onClick={() => setActiveTab(activeTab === 'following' ? null : 'following')}
            className={`flex items-center gap-1 hover:text-indigo-400 transition-all ${
              activeTab === 'following' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <span className="font-bold text-slate-100">{profile.followingCount}</span> Following
          </button>
          <button
            onClick={() => setActiveTab(activeTab === 'followers' ? null : 'followers')}
            className={`flex items-center gap-1 hover:text-indigo-400 transition-all ${
              activeTab === 'followers' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <span className="font-bold text-slate-100">{profile.followersCount}</span> Followers
          </button>
        </div>

        {/* Dynamic Lists Tab Container */}
        {activeTab && (
          <div className="mt-6 rounded-xl border border-slate-900 bg-slate-900/20 p-4">
            <div className="mb-4 flex items-center justify-between border-b border-slate-900 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {activeTab}
              </h3>
              <button
                onClick={() => setActiveTab(null)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-all"
              >
                Close List
              </button>
            </div>

            {/* List Loader / Empty States */}
            {activeTab === 'followers' && followersLoading && (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </div>
            )}

            {activeTab === 'following' && followingLoading && (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </div>
            )}

            {activeTab === 'followers' && !followersLoading && followers.length === 0 && (
              <p className="text-center py-6 text-xs text-slate-500">No followers yet.</p>
            )}

            {activeTab === 'following' && !followingLoading && following.length === 0 && (
              <p className="text-center py-6 text-xs text-slate-500">Not following anyone yet.</p>
            )}

            {/* Lists rendering */}
            <div className="space-y-4">
              {activeTab === 'followers' &&
                !followersLoading &&
                followers.map((f) => (
                  <div key={f.id} className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => {
                        setActiveTab(null);
                        router.push(`/${f.username}`);
                      }}
                    >
                      <div className="h-10 w-10 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center">
                        {f.avatarUrl ? (
                          <img
                            src={f.avatarUrl}
                            alt={f.username}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold uppercase text-slate-600">
                            {f.username.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold hover:underline text-slate-200">
                          {f.displayName || f.username}
                        </p>
                        <p className="text-xs text-slate-500">@{f.username}</p>
                      </div>
                    </div>
                  </div>
                ))}

              {activeTab === 'following' &&
                !followingLoading &&
                following.map((f) => (
                  <div key={f.id} className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => {
                        setActiveTab(null);
                        router.push(`/${f.username}`);
                      }}
                    >
                      <div className="h-10 w-10 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center">
                        {f.avatarUrl ? (
                          <img
                            src={f.avatarUrl}
                            alt={f.username}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold uppercase text-slate-600">
                            {f.username.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold hover:underline text-slate-200">
                          {f.displayName || f.username}
                        </p>
                        <p className="text-xs text-slate-500">@{f.username}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

