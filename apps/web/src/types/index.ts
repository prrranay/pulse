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
