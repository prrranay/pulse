'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { ApiResponse } from '../types';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../hooks/auth-context';
import { useSocket } from '../hooks/socket-context';

export default function ChatBadge() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  // 1. Fetch historical unread count
  const { data: unreadRes } = useQuery<ApiResponse<{ count: number }>>({
    queryKey: ['chat-unread-count'],
    queryFn: () => apiClient.get<ApiResponse<{ count: number }>>('/chat/unread-count'),
    enabled: !!user,
    refetchInterval: 30000, // Check every 30 seconds as fallback
  });

  const unreadCount = unreadRes?.data?.count ?? 0;

  // 2. Listen for socket message events on the global notifications socket
  useEffect(() => {
    if (!socket) return;

    const handleUnreadUpdate = (data: { count: number }) => {
      queryClient.setQueryData(['chat-unread-count'], {
        data: { count: data.count },
      });
    };

    socket.on('chat_unread_update', handleUnreadUpdate);

    return () => {
      socket.off('chat_unread_update', handleUnreadUpdate);
    };
  }, [socket, queryClient]);

  return (
    <Link
      href="/chat"
      className="relative rounded-full p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all flex items-center justify-center"
      title="Messages"
    >
      <MessageSquare className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-extrabold text-white shadow-lg border border-slate-950 animate-pulse">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
