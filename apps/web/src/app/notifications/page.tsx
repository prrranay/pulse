'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/auth-context';
import { useSocket } from '../../hooks/socket-context';
import { apiClient } from '../../lib/api-client';
import { ApiResponse } from '../../types';
import {
  ArrowLeft,
  Heart,
  MessageSquare,
  UserPlus,
  Repeat,
  CheckCheck,
  Calendar,
} from 'lucide-react';

/* eslint-disable @next/next/no-img-element */

interface ActorSummary {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface NotificationItem {
  id: string;
  type: 'LIKE' | 'COMMENT' | 'REPLY' | 'FOLLOW' | 'REPOST';
  readAt: string | null;
  createdAt: string;
  actor: ActorSummary;
  post: { id: string; content: string } | null;
  comment: { id: string; content: string } | null;
}

export default function NotificationsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [realtimeNotifications, setRealtimeNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // 1. Fetch Notifications List
  const { data: notificationsRes, isLoading } = useQuery<
    ApiResponse<NotificationItem[]>
  >({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get<ApiResponse<NotificationItem[]>>('/notifications?limit=40'),
    enabled: !!user,
  });

  const dbNotifications = notificationsRes?.data ?? [];
  const allNotifications = [...realtimeNotifications, ...dbNotifications];

  // 2. Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.patch<ApiResponse<unknown>>('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-bell'] });
      setRealtimeNotifications([]);
    },
  });

  // 3. Mark individual as read mutation
  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch<ApiResponse<unknown>>(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-bell'] });
    },
  });

  // 4. Real-time insertion
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification: unknown) => {
      setRealtimeNotifications((prev) => [notification as NotificationItem, ...prev]);
    };

    socket.on('notification', handleNewNotification);

    return () => {
      socket.off('notification', handleNewNotification);
    };
  }, [socket]);

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.readAt) {
      markReadMutation.mutate(item.id);
    }

    if (item.type === 'FOLLOW') {
      router.push(`/${item.actor.username}`);
    } else if (item.post) {
      router.push(`/posts/${item.post.id}`);
    }
  };

  const getNotificationDetails = (item: NotificationItem) => {
    switch (item.type) {
      case 'LIKE':
        return {
          icon: <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />,
          text: 'liked your post',
          preview: item.post?.content,
        };
      case 'COMMENT':
        return {
          icon: <MessageSquare className="h-4 w-4 text-indigo-400" />,
          text: 'commented on your post',
          preview: item.comment?.content || item.post?.content,
        };
      case 'REPLY':
        return {
          icon: <MessageSquare className="h-4 w-4 text-purple-400" />,
          text: 'replied to your comment',
          preview: item.comment?.content,
        };
      case 'FOLLOW':
        return {
          icon: <UserPlus className="h-4 w-4 text-emerald-400" />,
          text: 'started following you',
          preview: null,
        };
      case 'REPOST':
        return {
          icon: <Repeat className="h-4 w-4 text-emerald-400" />,
          text: 'reposted your post',
          preview: item.post?.content,
        };
      default:
        return {
          icon: null,
          text: 'interacted with your profile',
          preview: null,
        };
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      <div className="mx-auto max-w-xl px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-black bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            Notifications
          </h1>
          {allNotifications.some((n) => !n.readAt) && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-slate-900 bg-slate-900/50 hover:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
            </button>
          )}
        </div>
        {/* Loading History */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        )}

        {/* Empty view */}
        {!isLoading && allNotifications.length === 0 && (
          <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-12 text-center">
            <p className="text-sm font-semibold text-slate-400">All quiet here.</p>
            <p className="mt-1 text-xs text-slate-600">
              You will be notified here when someone follows you, likes or comments on your posts.
            </p>
          </div>
        )}

        {/* Notifications list */}
        <div className="space-y-3">
          {allNotifications.map((item) => {
            const details = getNotificationDetails(item);
            const isUnread = !item.readAt;

            return (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`relative rounded-xl border p-4 backdrop-blur-xl shadow-sm transition-all cursor-pointer flex gap-4 ${
                  isUnread
                    ? 'border-indigo-500/20 bg-slate-900/40 hover:bg-slate-900/60'
                    : 'border-slate-900 bg-slate-900/10 hover:bg-slate-900/20'
                }`}
              >
                {/* Unread Glow Dot indicator */}
                {isUnread && (
                  <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                )}

                {/* Left Action Icon indicator */}
                <div className="mt-1 shrink-0">{details.icon}</div>

                {/* Main Body */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start gap-2.5">
                    {/* Actor Avatar */}
                    <div className="h-8 w-8 shrink-0 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-indigo-500/10">
                      {item.actor.avatarUrl ? (
                        <img
                          src={item.actor.avatarUrl}
                          alt={item.actor.username}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold uppercase text-slate-600">
                          {item.actor.username.slice(0, 2)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-300">
                        <span className="font-bold text-slate-100">
                          {item.actor.displayName || item.actor.username}
                        </span>{' '}
                        {details.text}
                      </p>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-600 mt-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Target Preview element */}
                  {details.preview && (
                    <div className="ml-10 rounded-lg border border-slate-900 bg-slate-950/40 p-2.5 text-xs text-slate-400 truncate max-w-full italic">
                      &ldquo;{details.preview}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
