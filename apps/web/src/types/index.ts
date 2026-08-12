/** Shared TypeScript types for the Pulse frontend */

export interface ApiResponse<T> {
  statusCode: number;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
  method: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
  createdAt: string;
  updatedAt: string;
}

export interface AuthorSummary {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface PostResponse {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  author: AuthorSummary;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  isReposted: boolean;
}

export interface ReplyResponse {
  id: string;
  content: string;
  createdAt: string;
  author: AuthorSummary;
}

export interface CommentResponse {
  id: string;
  content: string;
  createdAt: string;
  author: AuthorSummary;
  replies: ReplyResponse[];
}
