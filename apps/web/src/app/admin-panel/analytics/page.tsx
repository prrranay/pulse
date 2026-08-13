'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { ApiResponse, AnalyticsResponse } from '../../../types';
import { RefreshCw, TrendingUp, Calendar, FileSpreadsheet } from 'lucide-react';

export default function AdminAnalyticsPage() {
  // 1. Fetch Analytics data
  const {
    data: analyticsRes,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<ApiResponse<AnalyticsResponse>>({
    queryKey: ['admin-analytics'],
    queryFn: () => apiClient.get<ApiResponse<AnalyticsResponse>>('/admin/analytics'),
  });

  const data = analyticsRes?.data;

  // Helper to find the maximum count to calculate percentage height for visual bars
  const maxUserGrowth = Math.max(1, ...(data?.userGrowth.map((d) => d.count) ?? []));
  const maxPostsPerDay = Math.max(1, ...(data?.postsPerDay.map((d) => d.count) ?? []));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight sm:text-2xl text-slate-100">
            Analytics & Trends
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Daily signup frequencies and engagement trends over the past 30 days.
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
        <div className="space-y-6">
          <div className="h-64 animate-pulse rounded-xl border border-slate-900 bg-slate-900/30" />
          <div className="h-64 animate-pulse rounded-xl border border-slate-900 bg-slate-900/30" />
        </div>
      ) : !data ? (
        <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-12 text-center">
          <p className="text-sm font-semibold text-slate-400">Failed to load analytics.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* User Signups bar chart panel */}
          <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-6 space-y-6">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <TrendingUp className="h-4 w-4 text-emerald-400" /> User Signups (30d)
            </h3>
            {/* Custom SVG/Bar Chart */}
            <div className="h-48 flex items-end gap-1 border-b border-slate-900 pb-2">
              {data.userGrowth.map((point) => {
                const heightPercent = `${Math.max(5, (point.count / maxUserGrowth) * 100)}%`;
                return (
                  <div
                    key={point.date}
                    className="group relative flex-1 flex flex-col items-center justify-end h-full"
                  >
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-full mb-1 z-20 hidden group-hover:block rounded bg-slate-950 border border-slate-800 px-2 py-1 text-[8px] font-bold text-slate-100 whitespace-nowrap shadow-xl">
                      {point.count} signups on {point.date}
                    </div>
                    {/* Visual Bar */}
                    <div
                      style={{ height: heightPercent }}
                      className="w-full rounded-t bg-gradient-to-t from-emerald-600 to-emerald-500 opacity-80 group-hover:opacity-100 transition-all cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>{data.userGrowth[0]?.date}</span>
              <span>{data.userGrowth[Math.floor(data.userGrowth.length / 2)]?.date}</span>
              <span>{data.userGrowth[data.userGrowth.length - 1]?.date}</span>
            </div>
          </div>

          {/* Posts created per day chart panel */}
          <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-6 space-y-6">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <FileSpreadsheet className="h-4 w-4 text-indigo-400" /> Post Velocity (30d)
            </h3>
            {/* Custom SVG/Bar Chart */}
            <div className="h-48 flex items-end gap-1 border-b border-slate-900 pb-2">
              {data.postsPerDay.map((point) => {
                const heightPercent = `${Math.max(5, (point.count / maxPostsPerDay) * 100)}%`;
                return (
                  <div
                    key={point.date}
                    className="group relative flex-1 flex flex-col items-center justify-end h-full"
                  >
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-full mb-1 z-20 hidden group-hover:block rounded bg-slate-950 border border-slate-800 px-2 py-1 text-[8px] font-bold text-slate-100 whitespace-nowrap shadow-xl">
                      {point.count} posts on {point.date}
                    </div>
                    {/* Visual Bar */}
                    <div
                      style={{ height: heightPercent }}
                      className="w-full rounded-t bg-gradient-to-t from-indigo-600 to-indigo-500 opacity-80 group-hover:opacity-100 transition-all cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>{data.postsPerDay[0]?.date}</span>
              <span>{data.postsPerDay[Math.floor(data.postsPerDay.length / 2)]?.date}</span>
              <span>{data.postsPerDay[data.postsPerDay.length - 1]?.date}</span>
            </div>
          </div>

          {/* Metrics Trend Log Table */}
          <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-6 space-y-4">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Calendar className="h-4 w-4 text-purple-400" /> Daily Aggregates Log
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[10px]">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-900/20 text-slate-500 font-semibold uppercase tracking-wider text-[9px]">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">New Signups</th>
                    <th className="px-4 py-2.5">Posts Shared</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 font-mono">
                  {data.userGrowth
                    .slice()
                    .reverse()
                    .slice(0, 7) // Show past week log table
                    .map((item, idx) => {
                      const postItem = data.postsPerDay[data.postsPerDay.length - 1 - idx];
                      return (
                        <tr key={item.date} className="hover:bg-slate-900/10">
                          <td className="px-4 py-2 text-slate-300">{item.date}</td>
                          <td className="px-4 py-2 text-emerald-400">+{item.count}</td>
                          <td className="px-4 py-2 text-indigo-400">+{postItem?.count ?? 0}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
