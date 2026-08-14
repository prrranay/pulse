'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { ApiResponse, AdminUserListItem } from '../../../types';
import { Search, Ban, CheckCircle, RefreshCw, UserCheck } from 'lucide-react';
import ConfirmModal from '../../../components/confirm-modal';

export default function AdminUsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchVal, setSearchVal] = useState('');
  const [page, setPage] = useState(1);

  // Reset page to 1 when search value changes
  useEffect(() => {
    setPage(1);
  }, [searchVal]);

  // 1. Fetch Users
  const {
    data: usersRes,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<ApiResponse<{
    users: AdminUserListItem[];
    meta: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  }>>({
    queryKey: ['admin-users', searchVal, page],
    queryFn: () =>
      apiClient.get<ApiResponse<{
        users: AdminUserListItem[];
        meta: {
          total: number;
          page: number;
          limit: number;
          pages: number;
        };
      }>>(`/admin/users?search=${searchVal}&page=${page}&limit=10`),
  });

  const { users = [], meta } = usersRes?.data ?? {};
  const [error, setError] = useState<string | null>(null);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);

  // 2. Suspend User Mutation
  const suspendMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.patch<ApiResponse<unknown>>(`/admin/users/${userId}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
  });

  // 3. Unsuspend User Mutation
  const unsuspendMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.patch<ApiResponse<unknown>>(`/admin/users/${userId}/unsuspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
  });

  const handleSuspendToggle = (user: AdminUserListItem) => {
    if (user.role === 'ADMIN') {
      setError('Administrators cannot be suspended.');
      return;
    }
    if (user.isSuspended) {
      unsuspendMutation.mutate(user.id);
    } else {
      setSelectedUser(user);
      setShowSuspendConfirm(true);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight sm:text-2xl text-slate-100">
            User Management
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Monitor account activity, roles, and suspension states.
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

      {error && (
        <div className="flex items-center justify-between rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400 max-w-md">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 font-bold ml-2 text-sm"
          >
            ×
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-600" />
        <input
          type="text"
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          placeholder="Search by username, display name, or email..."
          className="w-full rounded-lg border border-slate-900 bg-slate-900/40 py-2 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-500/40 transition-all"
        />
      </div>

      {/* Listing Grid */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-slate-900 bg-slate-900/30"
            />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-12 text-center">
          <p className="text-sm font-semibold text-slate-400">No users found.</p>
          <p className="mt-1 text-xs text-slate-600">Try modifying your search criteria.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-900 bg-slate-900/10 backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-900/20 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="px-6 py-4">Developer</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Activity</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {users.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-900/20 transition-all cursor-pointer"
                    onClick={() => router.push(`/${item.username}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 uppercase">
                          {item.username.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-200">
                            {item.displayName || item.username}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            @{item.username} • {item.role}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-mono">{item.email}</td>
                    <td className="px-6 py-4 text-slate-400">
                      {item._count.posts} posts • {item._count.comments} comments
                    </td>
                    <td className="px-6 py-4">
                      {item.isSuspended ? (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/15">
                          <Ban className="h-3 w-3" /> Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/15">
                          <CheckCircle className="h-3 w-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.role !== 'ADMIN' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSuspendToggle(item);
                          }}
                          disabled={suspendMutation.isPending || unsuspendMutation.isPending}
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all shadow-sm ${
                            item.isSuspended
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'bg-rose-600/10 border border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600'
                          }`}
                        >
                          {item.isSuspended ? (
                            <>
                              <UserCheck className="h-3.5 w-3.5" /> Restore
                            </>
                          ) : (
                            <>
                              <Ban className="h-3.5 w-3.5" /> Suspend
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {meta && meta.pages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-900 px-6 py-4 text-xs bg-slate-900/5">
              <p className="text-slate-500">
                Showing Page <span className="font-semibold text-slate-350">{meta.page}</span> of{' '}
                <span className="font-semibold text-slate-350">{meta.pages}</span> (Total{' '}
                <span className="font-semibold text-slate-350">{meta.total}</span> users)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPage((p) => Math.max(1, p - 1));
                  }}
                  disabled={meta.page <= 1}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-semibold text-slate-400 hover:bg-slate-850 hover:text-slate-200 transition-all disabled:opacity-30 disabled:pointer-events-none"
                >
                  Previous
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPage((p) => Math.min(meta.pages, p + 1));
                  }}
                  disabled={meta.page >= meta.pages}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-semibold text-slate-400 hover:bg-slate-850 hover:text-slate-200 transition-all disabled:opacity-30 disabled:pointer-events-none"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={showSuspendConfirm}
        title="Suspend User"
        message={`Are you sure you want to suspend @${selectedUser?.username}? They will lose access to the platform.`}
        confirmText="Suspend"
        isDanger={true}
        onConfirm={() => {
          setShowSuspendConfirm(false);
          if (selectedUser) suspendMutation.mutate(selectedUser.id);
        }}
        onCancel={() => {
          setShowSuspendConfirm(false);
          setSelectedUser(null);
        }}
      />
    </div>
  );
}
