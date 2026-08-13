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
  isOnline?: boolean;
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
  moderationStatus?: 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REJECTED';
}

export interface ReplyResponse {
  id: string;
  content: string;
  createdAt: string;
  author: AuthorSummary;
  moderationStatus?: 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REJECTED';
}

export interface CommentResponse {
  id: string;
  content: string;
  createdAt: string;
  author: AuthorSummary;
  replies: ReplyResponse[];
  moderationStatus?: 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REJECTED';
}

export interface SearchResultsResponse {
  users: Array<{
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  }>;
  posts: PostResponse[];
  communities: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export interface ExploreDataResponse {
  trendingPosts: PostResponse[];
  suggestedUsers: Array<{
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  }>;
  popularCommunities: Array<{
    id: string;
    name: string;
    description: string;
    memberCount: number;
  }>;
  recentPosts: PostResponse[];
}

export interface CommunityDetailsResponse {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  ownerId: string;
  memberCount: number;
  isMember: boolean;
  role: 'MEMBER' | 'MODERATOR' | 'OWNER' | null;
}

export interface AdminMetricsResponse {
  totalUsers: number;
  activeUsers: number;
  totalPosts: number;
  totalComments: number;
  totalCommunities: number;
  totalMessages: number;
  flaggedPosts: number;
}

export interface AdminUserListItem {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
  isSuspended: boolean;
  createdAt: string;
  _count: {
    posts: number;
    comments: number;
  };
}

export interface FlaggedContentItem {
  id: string;
  type: 'POST' | 'COMMENT';
  content: string;
  moderationStatus: 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REJECTED';
  createdAt: string;
  author: {
    username: string;
    displayName: string | null;
  };
}

export interface AdminFlaggedContentResponse {
  posts: FlaggedContentItem[];
  comments: FlaggedContentItem[];
}

export interface AnalyticsDataPoint {
  date: string;
  count: number;
}

export interface AnalyticsResponse {
  userGrowth: AnalyticsDataPoint[];
  postsPerDay: AnalyticsDataPoint[];
}
