'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { ApiResponse, AdminFlaggedContentResponse, FlaggedContentItem } from '../../../types';
import { RefreshCw, Check, X, ShieldAlert, FileText, MessageSquare } from 'lucide-react';

export default function AdminModerationPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'posts' | 'comments'>('posts');

  // 1. Fetch Flagged Content
  const {
    data: modRes,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<ApiResponse<AdminFlaggedContentResponse>>({
    queryKey: ['admin-flagged'],
    queryFn: () => apiClient.get<ApiResponse<AdminFlaggedContentResponse>>('/admin/moderation'),
  });

  const content = modRes?.data;
  const list = activeTab === 'posts' ? content?.posts ?? [] : content?.comments ?? [];

  // 2. Approve Content Mutation
  const approveMutation = useMutation({
    mutationFn: (data: { id: string; type: 'POST' | 'COMMENT' }) =>
      apiClient.patch<ApiResponse<unknown>>(`/admin/moderation/${data.id}/approve`, {
        type: data.type,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-flagged'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
  });

  // 3. Reject/Remove Content Mutation
  const rejectMutation = useMutation({
    mutationFn: (data: { id: string; type: 'POST' | 'COMMENT' }) =>
      apiClient.patch<ApiResponse<unknown>>(`/admin/moderation/${data.id}/reject`, {
        type: data.type,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-flagged'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
  });

  const handleApprove = (item: FlaggedContentItem) => {
    approveMutation.mutate({ id: item.id, type: item.type });
  };

  const handleReject = (item: FlaggedContentItem) => {
    if (confirm(`Are you sure you want to reject/remove this ${item.type.toLowerCase()}?`)) {
      rejectMutation.mutate({ id: item.id, type: item.type });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight sm:text-2xl text-slate-100">
            Moderation Queue
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Review content flagged by the Gemini Flash AI safety filters.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-850 hover:text-slate-200 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-900 text-sm">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-1.5 px-4 py-2.5 font-bold transition-all border-b-2 ${
            activeTab === 'posts'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-200'
          }`}
        >
          <FileText className="h-4 w-4 text-indigo-400" /> Posts
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={`flex items-center gap-1.5 px-4 py-2.5 font-bold transition-all border-b-2 ${
            activeTab === 'comments'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="h-4 w-4 text-purple-400" /> Comments
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-slate-900 bg-slate-900/30"
            />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-12 text-center">
          <p className="text-sm font-semibold text-slate-400">All clear!</p>
          <p className="mt-1 text-xs text-slate-600">No flagged {activeTab} in queue.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-900 bg-slate-900/10 p-5 space-y-4 transition-all hover:border-slate-800"
            >
              {/* Card Meta */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500">
                    BY @{item.author.username}
                  </span>
                  <p className="text-[9px] text-slate-600 font-mono">
                    ID: {item.id} • {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-semibold uppercase ${
                    item.moderationStatus === 'REJECTED'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/15'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                  }`}
                >
                  <ShieldAlert className="h-3 w-3" /> {item.moderationStatus}
                </span>
              </div>

              {/* Card Content */}
              <div className="rounded-lg border border-slate-900/80 bg-slate-950/40 p-3">
                <p className="text-xs text-slate-300 whitespace-pre-wrap">{item.content}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 border-t border-slate-900 pt-3">
                <button
                  onClick={() => handleReject(item)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="flex items-center gap-1 rounded-lg bg-rose-600/10 border border-rose-500/10 px-3 py-1.5 text-[10px] font-bold text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" /> Reject & Remove
                </button>
                <button
                  onClick={() => handleApprove(item)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-500 transition-all disabled:opacity-50 shadow-md"
                >
                  <Check className="h-3.5 w-3.5" /> Approve & Restore
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
