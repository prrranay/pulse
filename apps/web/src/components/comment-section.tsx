'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/auth-context';
import { apiClient } from '../lib/api-client';
import { CommentResponse, ApiResponse } from '../types';
import { CornerDownRight, Reply, Calendar } from 'lucide-react';

/* eslint-disable @next/next/no-img-element */

export default function CommentSection({ postId }: { postId: string }) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [commentContent, setCommentContent] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);

  // 1. Fetch Comments
  const { data: commentsRes, isLoading } = useQuery<ApiResponse<CommentResponse[]>>({
    queryKey: ['comments', postId],
    queryFn: () => apiClient.get<ApiResponse<CommentResponse[]>>(`/posts/${postId}/comments`),
    enabled: !!postId,
  });

  const comments = commentsRes?.data ?? [];

  // 2. Add Comment Mutation
  const addCommentMutation = useMutation({
    mutationFn: (content: string) =>
      apiClient.post<ApiResponse<unknown>>(`/posts/${postId}/comments`, { content }),
    onSuccess: () => {
      setCommentContent('');
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  // 3. Add Reply Mutation
  const addReplyMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      apiClient.post<ApiResponse<unknown>>(`/comments/${commentId}/replies`, { content }),
    onSuccess: () => {
      setReplyContent('');
      setActiveReplyId(null);
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;
    addCommentMutation.mutate(commentContent.trim());
  };

  const handleAddReply = (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    addReplyMutation.mutate({ commentId, content: replyContent.trim() });
  };

  return (
    <div className="space-y-6">
      <div className="border-t border-slate-900 pt-6">
        <h3 className="text-sm font-bold text-slate-300">Comments</h3>
      </div>

      {/* New Comment Input */}
      {currentUser ? (
        <form onSubmit={handleAddComment} className="flex gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-indigo-500/10">
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.username}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold uppercase text-slate-600">
                {currentUser.username.slice(0, 2)}
              </span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Write a comment..."
              rows={2}
              className="w-full rounded-lg border border-slate-900 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-700 outline-none focus:border-indigo-500 transition-all resize-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!commentContent.trim() || addCommentMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-indigo-500 disabled:opacity-50"
              >
                {addCommentMutation.isPending ? 'Posting...' : 'Comment'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p className="text-xs text-slate-500 italic">Sign in to write a comment.</p>
      )}

      {/* Loader */}
      {isLoading && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      )}

      {/* Comment List */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="space-y-3">
            <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 shrink-0 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-indigo-500/10">
                  {comment.author.avatarUrl ? (
                    <img
                      src={comment.author.avatarUrl}
                      alt={comment.author.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold uppercase text-slate-600">
                      {comment.author.username.slice(0, 2)}
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-bold text-slate-200">
                        {comment.author.displayName || comment.author.username}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        @{comment.author.username}
                      </span>
                      <span className="text-[9px] text-slate-600">·</span>
                      <span className="flex items-center gap-0.5 text-[9px] text-slate-600">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(comment.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    {currentUser && (
                      <button
                        onClick={() =>
                          setActiveReplyId(activeReplyId === comment.id ? null : comment.id)
                        }
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-400"
                      >
                        <Reply className="h-3 w-3" /> Reply
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              </div>

              {/* Reply Form */}
              {activeReplyId === comment.id && currentUser && (
                <form
                  onSubmit={(e) => handleAddReply(e, comment.id)}
                  className="mt-3 flex gap-3 border-t border-slate-900 pt-3"
                >
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={`Reply to @${comment.author.username}...`}
                      className="w-full rounded-lg border border-slate-900 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-700 outline-none focus:border-indigo-500 transition-all"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReplyId(null);
                          setReplyContent('');
                        }}
                        className="rounded-lg border border-slate-800 px-3 py-1 text-[10px] font-semibold text-slate-400 hover:bg-slate-900 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!replyContent.trim() || addReplyMutation.isPending}
                        className="rounded-lg bg-indigo-600 px-3 py-1 text-[10px] font-semibold text-white transition-all hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {addReplyMutation.isPending ? 'Replying...' : 'Reply'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Replies List */}
            {comment.replies.map((reply) => (
              <div
                key={reply.id}
                className="ml-6 flex items-start gap-3 rounded-xl border border-slate-900 bg-slate-900/5 p-3"
              >
                <CornerDownRight className="h-4 w-4 shrink-0 text-slate-600 mt-1.5" />
                <div className="h-7 w-7 shrink-0 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-indigo-500/10">
                  {reply.author.avatarUrl ? (
                    <img
                      src={reply.author.avatarUrl}
                      alt={reply.author.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] font-bold uppercase text-slate-600">
                      {reply.author.username.slice(0, 2)}
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-bold text-slate-200">
                      {reply.author.displayName || reply.author.username}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      @{reply.author.username}
                    </span>
                    <span className="text-[9px] text-slate-600">·</span>
                    <span className="flex items-center gap-0.5 text-[9px] text-slate-600">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(reply.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{reply.content}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
