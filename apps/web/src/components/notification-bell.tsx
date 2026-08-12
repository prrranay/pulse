'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSocket } from '../hooks/socket-context';
import { apiClient } from '../lib/api-client';
import { ApiResponse } from '../types';
import { Bell } from 'lucide-react';
import Link from 'next/link';

interface NotificationItem {
  id: string;
  readAt: string | null;
}

export default function NotificationBell() {
  const { socket } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);

  // 1. Fetch historical notifications to determine unread count
  const { data: notificationsRes } = useQuery<ApiResponse<NotificationItem[]>>({
    queryKey: ['notifications-bell'],
    queryFn: () => apiClient.get<ApiResponse<NotificationItem[]>>('/notifications?limit=50'),
    refetchInterval: 60000, // Sync every minute as a fallback
  });

  useEffect(() => {
    if (notificationsRes?.data) {
      const count = notificationsRes.data.filter((n) => !n.readAt).length;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadCount(count);
    }
  }, [notificationsRes]);

  // 2. Real-Time WebSocket Listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = () => {
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification', handleNewNotification);

    return () => {
      socket.off('notification', handleNewNotification);
    };
  }, [socket]);

  return (
    <Link
      href="/notifications"
      className="relative rounded-full p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all"
      title="Notifications"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-md">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
