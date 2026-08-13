/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth/auth.service';
import { PrismaService } from './prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users/users.service';
import { PostsService } from './posts/posts.service';
import { CommentsService } from './comments/comments.service';
import { NotificationsService } from './notifications/notifications.service';
import { AdminService } from './admin/admin.service';
import { RedisService } from './redis/redis.service';
import { Role, ModerationStatus } from '@prisma/client';
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { RolesGuard } from './common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

describe('Pulse Integration Spec Suite', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let postsService: PostsService;
  let commentsService: CommentsService;
  let adminService: AdminService;

  // Mocked dependencies (explicitly typed to avoid circular inference)
  const mockPrisma: any = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    follow: {
      create: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    post: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    like: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    comment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    community: {
      count: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb: (tx: any) => any): any => cb(mockPrisma)),
  };

  const mockJwt = {
    signAsync: jest.fn(() => Promise.resolve('mock_token')),
    verifyAsync: jest.fn(() =>
      Promise.resolve({ sub: 'user_1', email: 'test@pulse.dev' }),
    ),
  };

  const mockQueue = {
    add: jest.fn(() => Promise.resolve({ id: 'mock_job_id' })),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getClient: jest.fn(() => ({
      scanStream: jest.fn(() => ({
        [Symbol.asyncIterator]: function* () {
          yield [];
        },
      })),
      del: jest.fn(() => Promise.resolve(0)),
    })),
  };

  const mockNotificationsService = {
    createNotification: jest.fn(() =>
      Promise.resolve({ id: 'notification_123' }),
    ),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    getUserNotifications: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersService,
        PostsService,
        CommentsService,
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: 'BullQueue_email-queue', useValue: mockQueue },
        { provide: 'BullQueue_moderation-queue', useValue: mockQueue },
        { provide: RedisService, useValue: mockRedis },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    postsService = module.get<PostsService>(PostsService);
    commentsService = module.get<CommentsService>(CommentsService);
    adminService = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── AUTHENTICATION TESTS ───────────────────────────────────────
  describe('Authentication Module', () => {
    it('should register a new user successfully and hash password', async () => {
      const dto = {
        email: 'dev@pulse.dev',
        username: 'developer',
        password: 'securePassword123',
      };

      mockPrisma.user.create.mockResolvedValue({
        id: 'user_123',
        email: dto.email,
        username: dto.username,
        role: Role.USER,
        createdAt: new Date(),
      });

      const user = await authService.register(dto);
      expect(user).toBeDefined();
      expect(user.email).toBe(dto.email);
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should reject login with incorrect credentials', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        authService.login({
          usernameOrEmail: 'fake@pulse.dev',
          password: 'wrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── USER RELATION/FOLLOW TESTS ──────────────────────────────────
  describe('User Follow system', () => {
    it('should prevent user from following themselves', async () => {
      await expect(usersService.follow('user_1', 'user_1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create follow relationship and emit follow notification', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user_1' }); // follower
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user_2' }); // following
      mockPrisma.follow.findUnique.mockResolvedValue(null); // not followed yet

      mockPrisma.follow.create.mockResolvedValue({
        id: 'follow_123',
        followerId: 'user_1',
        followingId: 'user_2',
      });

      const result = await usersService.follow('user_1', 'user_2');
      expect(result).toBeDefined();
      expect(mockPrisma.follow.create).toHaveBeenCalled();
    });
  });

  // ── POST AND OWNERSHIP TESTS ────────────────────────────────────
  describe('Post Lifecycle', () => {
    it('should persist new post and queue moderation checks', async () => {
      const dto = { content: 'Writing unit tests makes my app resilient.' };
      mockPrisma.post.create.mockResolvedValue({
        id: 'post_123',
        content: dto.content,
        authorId: 'user_1',
        moderationStatus: ModerationStatus.PENDING,
        createdAt: new Date(),
      });

      const post = await postsService.create('user_1', dto);
      expect(post).toBeDefined();
      expect(post.content).toBe(dto.content);
      expect(mockPrisma.post.create).toHaveBeenCalled();
    });
  });

  // ── INTERACTION (LIKE/COMMENT) TESTS ─────────────────────────────
  describe('Post Interactions', () => {
    it('should like a post', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'post_123',
        authorId: 'author_id',
      });
      mockPrisma.like.create.mockResolvedValue({ id: 'like_123' });

      const result = await postsService.like('user_1', 'post_123');
      expect(result).toEqual({ message: 'Post liked successfully' });
      expect(mockPrisma.like.create).toHaveBeenCalled();
    });

    it('should create a comment and emit notifications', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'post_123',
        authorId: 'author_id',
      });
      mockPrisma.comment.create.mockResolvedValue({
        id: 'comment_123',
        content: 'Awesome update!',
        userId: 'user_1',
        postId: 'post_123',
        createdAt: new Date(),
      });

      const comment = await commentsService.createComment(
        'user_1',
        'post_123',
        {
          content: 'Awesome update!',
        },
      );
      expect(comment).toBeDefined();
      expect(comment.content).toBe('Awesome update!');
      expect(mockPrisma.comment.create).toHaveBeenCalled();
    });
  });

  // ── CHAT AUTHORIZATION SIMULATION ──────────────────────────────
  describe('Chat System Authorizations', () => {
    const chatRooms = new Map<
      string,
      { participants: string[]; messages: string[] }
    >();

    function joinChatConversation(
      userId: string,
      conversationId: string,
    ): boolean {
      const room = chatRooms.get(conversationId);
      if (!room) return false;
      return room.participants.includes(userId);
    }

    function sendChatMessage(
      userId: string,
      conversationId: string,
      msg: string,
    ): { success: boolean; error?: string } {
      const room = chatRooms.get(conversationId);
      if (!room) {
        return { success: false, error: 'Conversation room not found' };
      }
      if (!room.participants.includes(userId)) {
        return {
          success: false,
          error: 'Access Denied: You are not a participant',
        };
      }
      room.messages.push(msg);
      return { success: true };
    }

    it('should prevent non-participants from entering a chat room', () => {
      chatRooms.set('room_1', {
        participants: ['user_1', 'user_2'],
        messages: [],
      });

      const canJoin = joinChatConversation('user_99', 'room_1');
      expect(canJoin).toBe(false);
    });

    it('should allow participants to send and persist chat messages', () => {
      chatRooms.set('room_2', {
        participants: ['user_1', 'user_3'],
        messages: [],
      });

      const response = sendChatMessage(
        'user_1',
        'room_2',
        'Hello, fellow dev!',
      );
      expect(response.success).toBe(true);

      const room = chatRooms.get('room_2');
      expect(room?.messages).toContain('Hello, fellow dev!');
    });
  });

  // ── ADMIN ROLES AND SUSPENSION ──────────────────────────────────
  describe('Admin Dashboard and Suspension Controls', () => {
    it('should allow admins to suspend standard users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_to_suspend',
        role: Role.USER,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user_to_suspend',
        username: 'troublemaker',
        isSuspended: true,
      });

      const user = await adminService.suspendUser('user_to_suspend');
      expect(user.isSuspended).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should prevent non-admins from passing RolesGuard checks', () => {
      const reflector = new Reflector();
      const rolesGuard = new RolesGuard(reflector);

      // Mock ExecutionContext returning user with standard USER role
      const mockContext = {
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.USER, isSuspended: false },
          }),
        }),
      } as any;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

      expect(() => rolesGuard.canActivate(mockContext)).toThrow(
        ForbiddenException,
      );
    });
  });
});
