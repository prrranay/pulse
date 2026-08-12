'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { ApiResponse, AdminMetricsResponse } from '../../types';
import {
  Users,
  Activity,
  FileText,
  MessageCircle,
  FolderKanban,
  Flag,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const {
    data: metricsRes,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<ApiResponse<AdminMetricsResponse>>({
    queryKey: ['admin-metrics'],
    queryFn: () => apiClient.get<ApiResponse<AdminMetricsResponse>>('/admin/metrics'),
  });

  const metrics = metricsRes?.data;

  const cardItems = [
    {
      title: 'Total Users',
      value: metrics?.totalUsers ?? 0,
      description: 'Registered accounts',
      icon: Users,
      color: 'text-indigo-400 border-indigo-500/10 bg-indigo-500/5',
    },
    {
      title: 'Active Users (30d)',
      value: metrics?.activeUsers ?? 0,
      description: 'Users posting in past 30d',
      icon: Activity,
      color: 'text-emerald-400 border-emerald-500/10 bg-emerald-500/5',
    },
    {
      title: 'Total Posts',
      value: metrics?.totalPosts ?? 0,
      description: 'Shared developer stories',
      icon: FileText,
      color: 'text-purple-400 border-purple-500/10 bg-purple-500/5',
    },
    {
      title: 'Total Comments',
      value: metrics?.totalComments ?? 0,
      description: 'Thread replies',
      icon: MessageCircle,
      color: 'text-blue-400 border-blue-500/10 bg-blue-500/5',
    },
    {
      title: 'Communities',
      value: metrics?.totalCommunities ?? 0,
      description: 'Active developer hubs',
      icon: FolderKanban,
      color: 'text-amber-400 border-amber-500/10 bg-amber-500/5',
    },
    {
      title: 'Flagged Content',
      value: metrics?.flaggedPosts ?? 0,
      description: 'Requires safety review',
      icon: Flag,
      color: 'text-rose-400 border-rose-500/10 bg-rose-500/5',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight sm:text-2xl text-slate-100">
            Overview
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Real-time server activity logs and counts.
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

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-slate-900 bg-slate-900/30"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cardItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={`rounded-xl border p-6 flex flex-col justify-between transition-all hover:scale-[1.01] hover:border-slate-800 bg-slate-900/10`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">{item.title}</span>
                  <div className={`rounded-lg border p-1.5 ${item.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-2xl font-black tracking-tight text-slate-100">
                    {item.value}
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-500 flex items-center gap-1">
                    {item.description} <ArrowUpRight className="h-3 w-3" />
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
