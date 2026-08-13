'use client';

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../hooks/auth-context';
import { ApiResponse } from '../../types';
import {
  ArrowLeft,
  Send,
  MessageSquare,
  Loader2,
  Sparkles,
  Check,
  CheckCheck,
} from 'lucide-react';
import Link from 'next/link';

interface ChatUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface Conversation {
  id: string;
  updatedAt: string;
  otherParticipant: ChatUser;
  lastMessage: {
    content: string;
    createdAt: string;
  } | null;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: ChatUser;
  readAt?: string | null;
}

interface MessagesResponse {
  items: Message[];
  nextCursor: string | null;
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const conversationParamId = searchParams?.get('id');
  const activeConvId = conversationParamId || null;
  const activeConvIdRef = useRef<string | null>(activeConvId);
  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  const [typedMessage, setTypedMessage] = useState('');
  const socketRef = useRef<Socket | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  // 1. Fetch Conversations
  const { data: convsRes, isLoading: convsLoading } = useQuery<ApiResponse<Conversation[]>>({
    queryKey: ['chat-conversations'],
    queryFn: () => apiClient.get<ApiResponse<Conversation[]>>('/chat/conversations'),
    enabled: !!currentUser,
  });

  const conversations = convsRes?.data ?? [];

  // 2. Fetch messages in active conversation (Infinite scroll pagination)
  const {
    data: messagesData,
    isLoading: messagesLoading,
    fetchNextPage: fetchNextMessages,
    hasNextPage: hasNextMessages,
    isFetchingNextPage: isFetchingNextMessages,
  } = useInfiniteQuery<ApiResponse<MessagesResponse>>({
    queryKey: ['chat-messages', activeConvId],
    queryFn: ({ pageParam }) =>
      apiClient.get<ApiResponse<MessagesResponse>>(
        `/chat/conversations/${activeConvId}/messages?limit=25${pageParam ? `&cursor=${pageParam}` : ''}`
      ),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.data.nextCursor,
    enabled: !!currentUser && !!activeConvId,
  });

  const messages = messagesData?.pages.flatMap((page) => page.data.items).reverse() ?? [];

  // 3. Socket.IO Connection for Real-Time Messages
  useEffect(() => {
    if (!currentUser) return;

    const token = localStorage.getItem('pulse_token');
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';

    const newSocket = io(`${wsUrl}/chat`, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('Chat namespace socket connected successfully');
    });

    newSocket.on('message', (incomingMsg: Message) => {
      const currentActiveId = activeConvIdRef.current;
      // If message belongs to active conversation, update list
      if (incomingMsg.conversationId === currentActiveId && currentActiveId) {
        // Automatically mark incoming messages as read on the backend
        apiClient.post(`/chat/conversations/${currentActiveId}/read`).catch((err) => {
          console.error('Failed to mark incoming message as read:', err);
        });

        queryClient.setQueryData(
          ['chat-messages', currentActiveId],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (oldData: any) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              pages: oldData.pages.map((page: any, index: number) => {
                if (index === 0) {
                  return {
                    ...page,
                    data: {
                      ...page.data,
                      items: [incomingMsg, ...page.data.items],
                    },
                  };
                }
                return page;
              }),
            };
          }
        );
        // Scroll to bottom
        setTimeout(scrollToBottom, 50);
      }

      // Update conversations preview list and unread count
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat-unread-count'] });
    });

    newSocket.on('messages_read', ({ conversationId, readAt }: { conversationId: string; readAt: string }) => {
      const currentActiveId = activeConvIdRef.current;
      if (conversationId === currentActiveId && currentActiveId) {
        queryClient.setQueryData(
          ['chat-messages', currentActiveId],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (oldData: any) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              pages: oldData.pages.map((page: any) => {
                return {
                  ...page,
                  data: {
                    ...page.data,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    items: page.data.items.map((msg: any) => {
                      if (msg.senderId === currentUser.id && !msg.readAt) {
                        return { ...msg, readAt };
                      }
                      return msg;
                    }),
                  },
                };
              }),
            };
          }
        );
      }
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    });

    socketRef.current = newSocket;

    return () => {
      newSocket.disconnect();
    };
  }, [currentUser, queryClient]);

  // Automatically mark active conversation messages as read when loaded/opened
  useEffect(() => {
    if (!activeConvId) return;
    apiClient.post(`/chat/conversations/${activeConvId}/read`)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
        queryClient.invalidateQueries({ queryKey: ['chat-unread-count'] });
      })
      .catch((err) => {
        console.error('Failed to mark conversation as read:', err);
      });
  }, [activeConvId, queryClient]);

  // Scroll to bottom on conversation load or new incoming messages
  useEffect(() => {
    if (messages.length > 0 && !isFetchingNextMessages) {
      scrollToBottom();
    }
  }, [messages.length, activeConvId, isFetchingNextMessages]);

  // Handle older message fetch on scroll to top
  const handleScroll = () => {
    if (!messagesContainerRef.current || isFetchingNextMessages || !hasNextMessages) return;
    const { scrollTop } = messagesContainerRef.current;
    // Trigger loading older messages when near top
    if (scrollTop < 40) {
      fetchNextMessages();
    }
  };

  // 4. Send Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: (content: string) =>
      apiClient.post<ApiResponse<Message>>(`/chat/conversations/${activeConvId}/messages`, {
        content,
      }),
    onSuccess: (res) => {
      const sentMsg = res.data;
      setTypedMessage('');

      // Add to React Query cache immediately
      queryClient.setQueryData(
        ['chat-messages', activeConvId],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pages: oldData.pages.map((page: any, index: number) => {
              if (index === 0) {
                return {
                  ...page,
                  data: {
                    ...page.data,
                    items: [sentMsg, ...page.data.items],
                  },
                };
              }
              return page;
            }),
          };
        }
      );

      // Invalidate conversations list for preview text updates
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      setTimeout(scrollToBottom, 50);
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim() || !activeConvId) return;
    sendMessageMutation.mutate(typedMessage.trim());
  };

  const activeConversation = conversations.find((c) => c.id === activeConvId);

  if (authLoading || !currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      {/* Navbar Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-900 bg-slate-950/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-lg font-black tracking-wider text-transparent">
            Conversations
          </span>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side Pane: Conversations List */}
        <aside
          className={`w-full border-r border-slate-900 bg-slate-950 md:block md:w-80 shrink-0 ${
            activeConvId ? 'hidden md:flex' : 'flex'
          } flex-col`}
        >
          {convsLoading ? (
            <div className="flex flex-1 items-center justify-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
              <MessageSquare className="h-8 w-8 text-slate-700" />
              <p className="text-xs font-semibold text-slate-400">No chats started yet</p>
              <p className="text-[10px] text-slate-600 max-w-48 leading-relaxed">
                Go to a developer profile page and click &ldquo;Message&rdquo; to start talking.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-950 p-2 space-y-1">
              {conversations.map((conv) => {
                const isSelected = conv.id === activeConvId;
                const otherUser = conv.otherParticipant;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const isUnread = conv.lastMessage && (conv.lastMessage as any).senderId !== currentUser.id && !(conv.lastMessage as any).readAt;

                return (
                  <div
                    key={conv.id}
                    onClick={() => router.push(`/chat?id=${conv.id}`)}
                    className={`flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-600/10 border border-indigo-500/20'
                        : 'bg-transparent border border-transparent hover:bg-slate-900/40'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="h-10 w-10 shrink-0 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-indigo-500/10">
                      {otherUser.avatarUrl ? (
                        <img
                          src={otherUser.avatarUrl}
                          alt={otherUser.username}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold uppercase text-slate-600">
                          {otherUser.username.slice(0, 2)}
                        </span>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className={`text-xs truncate ${isUnread ? 'font-extrabold text-white' : 'font-bold text-slate-200'}`}>
                          {otherUser.displayName || otherUser.username}
                        </h4>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse shadow-md shadow-indigo-500/50" />
                          )}
                          {conv.lastMessage && (
                            <span className="text-[9px] text-slate-600">
                              {new Date(conv.lastMessage.createdAt).toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500">@{otherUser.username}</p>
                      <p className={`mt-1 text-[10px] truncate ${isUnread ? 'text-indigo-200 font-bold' : 'text-slate-500'}`}>
                        {conv.lastMessage ? conv.lastMessage.content : 'No messages yet'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* Right Side Pane: Chat Viewport */}
        <main
          className={`flex-1 bg-slate-950 flex flex-col overflow-hidden ${
            !activeConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConvId && activeConversation ? (
            <>
              {/* Recipient Profile Bar */}
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-900 bg-slate-950 px-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push('/chat')}
                    className="rounded-full p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all md:hidden"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>

                  <div className="h-9 w-9 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-indigo-500/10">
                    {activeConversation.otherParticipant.avatarUrl ? (
                      <img
                        src={activeConversation.otherParticipant.avatarUrl}
                        alt={activeConversation.otherParticipant.username}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold uppercase text-slate-600">
                        {activeConversation.otherParticipant.username.slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">
                      {activeConversation.otherParticipant.displayName ||
                        activeConversation.otherParticipant.username}
                    </h3>
                    <p className="text-[9px] text-slate-500">
                      @{activeConversation.otherParticipant.username}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/${activeConversation.otherParticipant.username}`}
                  className="rounded-full border border-slate-900 bg-slate-900/50 hover:bg-slate-900 px-3 py-1.5 text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-all"
                >
                  View Profile
                </Link>
              </div>

              {/* Messages Lists Viewport */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {isFetchingNextMessages && (
                  <div className="flex justify-center py-2 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}

                {messagesLoading ? (
                  <div className="flex h-full items-center justify-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center p-6 text-slate-500 space-y-1.5">
                    <Sparkles className="h-6 w-6 text-indigo-400" />
                    <p className="text-xs font-semibold text-slate-300">Start of conversation</p>
                    <p className="text-[10px] text-slate-600 max-w-48">
                      Say hello to @{activeConversation.otherParticipant.username}! Messages are secure.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isOutgoing = msg.senderId === currentUser.id;

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`flex flex-col max-w-[70%] space-y-0.5`}>
                            <div
                              className={`rounded-2xl px-4 py-2.5 text-xs shadow-md ${
                                isOutgoing
                                  ? 'bg-indigo-600 text-white rounded-br-none'
                                  : 'bg-slate-900 text-slate-200 rounded-bl-none'
                              }`}
                            >
                              <p className="leading-relaxed break-words">{msg.content}</p>
                            </div>
                            <span className={`text-[8px] text-slate-600 px-1 flex items-center justify-end gap-1 ${
                              isOutgoing ? 'text-right justify-end' : 'text-left justify-start'
                            }`}>
                              <span>
                                {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {isOutgoing && (
                                <span>
                                  {msg.readAt ? (
                                    <CheckCheck className="h-3 w-3 text-emerald-400 inline" />
                                  ) : (
                                    <Check className="h-3 w-3 text-slate-600 inline" />
                                  )}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Message Composer Area */}
              <div className="shrink-0 border-t border-slate-900 bg-slate-950 p-4">
                <form onSubmit={handleSendMessage} className="flex gap-3">
                  <input
                    type="text"
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    placeholder={`Message @${activeConversation.otherParticipant.username}...`}
                    className="flex-1 rounded-full border border-slate-900 bg-slate-900/40 px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-500/40 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!typedMessage.trim() || sendMessageMutation.isPending}
                    className="rounded-full bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 transition-all disabled:opacity-50 flex items-center justify-center shadow-md"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
              <MessageSquare className="h-10 w-10 text-slate-700" />
              <h3 className="text-sm font-semibold text-slate-400">No chat selected</h3>
              <p className="text-xs text-slate-600 max-w-64 leading-relaxed">
                Pick an existing direct conversation from the sidebar list, or visit a developer profile to launch a new chat.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

import { Suspense } from 'react';

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
