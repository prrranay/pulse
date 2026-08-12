'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { ApiResponse, PostResponse } from '../../../types';
import PostCard from '../../../components/post-card';
import CommentSection from '../../../components/comment-section';
import { PostSkeleton } from '../../../components/skeleton-loader';
import NotificationBell from '../../../components/notification-bell';
import { ArrowLeft } from 'lucide-react';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    data: postRes,
    isLoading,
    error,
  } = useQuery<ApiResponse<PostResponse>>({
    queryKey: ['post', id],
    queryFn: () => apiClient.get<ApiResponse<PostResponse>>(`/posts/${id}`),
    enabled: !!id,
  });

  const post = postRes?.data;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-sm font-bold text-slate-100">Loading Post</h2>
          </div>
          <NotificationBell />
        </header>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <PostSkeleton />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
        <h2 className="text-xl font-bold">Post Not Found</h2>
        <p className="mt-2 text-sm text-slate-500">
          This post may have been deleted or the link is broken.
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-bold text-slate-100">Thread</h2>
        </div>
        <NotificationBell />
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Main Post Card */}
        <PostCard post={post} />

        {/* Nested Comments Section */}
        <CommentSection postId={post.id} />
      </div>
    </div>
  );
}
