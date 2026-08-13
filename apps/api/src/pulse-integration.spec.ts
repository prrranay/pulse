/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Neutralize Bull connection errors during test suite teardown by mocking JobsModule entirely
jest.mock('./jobs/jobs.module', () => {
  const { Module, Global } = require('@nestjs/common');
  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  };

  @Global()
  @Module({
    providers: [
      {
        provide: 'BullQueue_email-queue',
        useValue: mockQueue,
      },
      {
        provide: 'BullQueue_moderation-queue',
        useValue: mockQueue,
      },
      require('./jobs/processors/moderation.processor').ModerationProcessor,
      require('./jobs/processors/email.processor').EmailProcessor,
      require('./ai/ai.service').AiService,
      require('./prisma/prisma.service').PrismaService,
    ],
    exports: [
      'BullQueue_email-queue',
      'BullQueue_moderation-queue',
      require('./jobs/processors/moderation.processor').ModerationProcessor,
    ],
  })
  class MockJobsModule {}

  return { JobsModule: MockJobsModule };
});

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ServiceUnavailableException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { Role, ModerationStatus } from '@prisma/client';
import { ModerationProcessor } from './jobs/processors/moderation.processor';

describe('Pulse End-to-End Integration Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let jwt: JwtService;
  let port: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();
    await app.listen(0);

    const httpServer = app.getHttpServer();
    const address = httpServer.address();
    port = typeof address === 'string' ? 0 : address.port;

    prisma = app.get<PrismaService>(PrismaService);
    redis = app.get<RedisService>(RedisService);
    jwt = app.get<JwtService>(JwtService);

    await prisma.$connect();
    await cleanupDb();
  });

  afterAll(async () => {
    await cleanupDb();
    await prisma.$disconnect();
    await app.close();
  });

  async function cleanupDb() {
    await prisma.message.deleteMany({});
    await prisma.conversationParticipant.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.like.deleteMany({});
    await prisma.bookmark.deleteMany({});
    await prisma.repost.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.follow.deleteMany({});
    await prisma.user.deleteMany({});
  }

  // ── AUTHENTICATION TESTS ───────────────────────────────────────
  describe('Authentication Flows', () => {
    it('should handle registration, duplicate emails, and logins', async () => {
      const regDto = {
        email: 'e2e_user@pulse.dev',
        username: 'e2e_user',
        password: 'SecurePassword123!',
      };

      // 1. Register successfully
      const regRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(regDto)
        .expect(201);
      expect(regRes.body.email).toBe(regDto.email);

      // 2. Reject duplicate email
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(regDto)
        .expect(409); // ConflictException

      // 3. Login successfully
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: regDto.email,
          password: regDto.password,
        })
        .expect(200);
      expect(loginRes.body.accessToken).toBeDefined();

      // 4. Reject invalid login credentials
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: regDto.email,
          password: 'wrong_password',
        })
        .expect(401);
    });

    it('should enforce role checks and access restrictions', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'standard_user@pulse.dev',
          username: 'standard_user',
          password: 'SecurePassword123!',
          role: Role.USER,
        },
      });

      const token = await jwt.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      // 1. Access protected route
      await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // 2. Block expired/invalid token
      await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer invalid_token`)
        .expect(401);

      // 3. Reject standard user accessing admin endpoint
      await request(app.getHttpServer())
        .get('/api/v1/admin/analytics')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  // ── SOCIAL INTERACTIONS TESTS ──────────────────────────────────
  describe('Social Core Flows', () => {
    it('should verify post creation, edits, follows, likes, and bookmarks', async () => {
      const userA = await prisma.user.create({
        data: {
          email: 'social_a@pulse.dev',
          username: 'social_a',
          password: 'Password123!',
        },
      });
      const userB = await prisma.user.create({
        data: {
          email: 'social_b@pulse.dev',
          username: 'social_b',
          password: 'Password123!',
        },
      });

      const tokenA = await jwt.signAsync({
        sub: userA.id,
        email: userA.email,
        role: userA.role,
      });
      const tokenB = await jwt.signAsync({
        sub: userB.id,
        email: userB.email,
        role: userB.role,
      });

      // 1. Create post
      const postRes = await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Integration test post.' })
        .expect(201);
      const postId = postRes.body.id;

      // 2. Edit own post (Patch method)
      await request(app.getHttpServer())
        .patch(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Updated integration test post.' })
        .expect(200);

      // 3. Reject editing another user's post
      await request(app.getHttpServer())
        .patch(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'Malicious update.' })
        .expect(403);

      // 4. Like post
      await request(app.getHttpServer())
        .post(`/api/v1/posts/${postId}/like`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      // 5. Prevent duplicate likes
      await request(app.getHttpServer())
        .post(`/api/v1/posts/${postId}/like`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(409); // ConflictException

      // 6. Bookmark post
      await request(app.getHttpServer())
        .post(`/api/v1/posts/${postId}/bookmark`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      // 7. Repost
      await request(app.getHttpServer())
        .post(`/api/v1/posts/${postId}/repost`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      // 8. Follows
      await request(app.getHttpServer())
        .post(`/api/v1/users/${userB.id}/follow`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(201);

      // 9. Prevent self-follow
      await request(app.getHttpServer())
        .post(`/api/v1/users/${userA.id}/follow`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400); // BadRequestException
    });
  });

  // ── MODERATION FILTERS TESTS ────────────────────────────────────
  describe('Moderation and Visibility Gates', () => {
    it('should respect visibility policies across pending/approved/rejected states', async () => {
      const author = await prisma.user.create({
        data: {
          email: 'author@pulse.dev',
          username: 'author',
          password: 'Password123!',
        },
      });
      const reader = await prisma.user.create({
        data: {
          email: 'reader@pulse.dev',
          username: 'reader',
          password: 'Password123!',
        },
      });
      const admin = await prisma.user.create({
        data: {
          email: 'admin_mod@pulse.dev',
          username: 'admin_mod',
          password: 'Password123!',
          role: Role.ADMIN,
        },
      });

      const tokenAuthor = await jwt.signAsync({
        sub: author.id,
        email: author.email,
        role: author.role,
      });
      const tokenReader = await jwt.signAsync({
        sub: reader.id,
        email: reader.email,
        role: reader.role,
      });
      const tokenAdmin = await jwt.signAsync({
        sub: admin.id,
        email: admin.email,
        role: admin.role,
      });

      // Make reader and admin follow author so posts appear in their home feeds
      await prisma.follow.createMany({
        data: [
          { followerId: reader.id, followingId: author.id },
          { followerId: admin.id, followingId: author.id },
        ],
      });

      // Create a pending post
      const postPending = await prisma.post.create({
        data: {
          content: 'Pending Content',
          authorId: author.id,
          moderationStatus: ModerationStatus.PENDING,
        },
      });

      // Create an approved post
      const postApproved = await prisma.post.create({
        data: {
          content: 'Approved Content',
          authorId: author.id,
          moderationStatus: ModerationStatus.APPROVED,
        },
      });

      // Create a rejected post
      const postRejected = await prisma.post.create({
        data: {
          content: 'Rejected Content',
          authorId: author.id,
          moderationStatus: ModerationStatus.REJECTED,
        },
      });

      // 1. Readers should only see APPROVED content in public feed
      const feedRes = await request(app.getHttpServer())
        .get('/api/v1/posts/feed')
        .set('Authorization', `Bearer ${tokenReader}`)
        .expect(200);
      const feedIds = feedRes.body.items.map((i: any) => i.id);
      expect(feedIds).toContain(postApproved.id);
      expect(feedIds).not.toContain(postPending.id);
      expect(feedIds).not.toContain(postRejected.id);

      // 2. Author can see their own PENDING post
      const authorFeedRes = await request(app.getHttpServer())
        .get('/api/v1/posts/feed')
        .set('Authorization', `Bearer ${tokenAuthor}`)
        .expect(200);
      const authorFeedIds = authorFeedRes.body.items.map((i: any) => i.id);
      expect(authorFeedIds).toContain(postPending.id);
      expect(authorFeedIds).not.toContain(postRejected.id);

      // 3. Admin can inspect flagged/rejected posts
      const adminFeedRes = await request(app.getHttpServer())
        .get('/api/v1/posts/feed')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(200);
      const adminFeedIds = adminFeedRes.body.items.map((i: any) => i.id);
      expect(adminFeedIds).toContain(postPending.id);
      expect(adminFeedIds).toContain(postRejected.id);
    });
  });

  // ── CHAT SERVICE TESTS ──────────────────────────────────────────
  describe('Chat System Logic', () => {
    it('should enforce deterministic unique direct conversations and access permissions', async () => {
      const userA = await prisma.user.create({
        data: {
          email: 'chat_a@pulse.dev',
          username: 'chat_a',
          password: 'Password123!',
        },
      });
      const userB = await prisma.user.create({
        data: {
          email: 'chat_b@pulse.dev',
          username: 'chat_b',
          password: 'Password123!',
        },
      });
      const userC = await prisma.user.create({
        data: {
          email: 'chat_c@pulse.dev',
          username: 'chat_c',
          password: 'Password123!',
        },
      });

      const tokenA = await jwt.signAsync({
        sub: userA.id,
        email: userA.email,
        role: userA.role,
      });
      const tokenC = await jwt.signAsync({
        sub: userC.id,
        email: userC.email,
        role: userC.role,
      });

      // 1. Create conversation (A & B) using targetUsername DTO
      const convRes1 = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ targetUsername: userB.username })
        .expect(201);
      const convId = convRes1.body.id;

      // 2. Fetching same pair (A & B) returns identical conversation (idempotent)
      const convRes2 = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ targetUsername: userB.username })
        .expect(201);
      expect(convRes2.body.id).toBe(convId);

      // 3. Non-participant (C) cannot access conversation history
      await request(app.getHttpServer())
        .get(`/api/v1/chat/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${tokenC}`)
        .expect(403);

      // 4. Participant (A) can send a message
      const msgRes = await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Hello social chat!' })
        .expect(201);
      expect(msgRes.body.content).toBe('Hello social chat!');

      // Verify persistence
      const messages = await prisma.message.findMany({
        where: { conversationId: convId },
      });
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Hello social chat!');
    });
  });

  // ── WEBSOCKET INTEGRATION TESTS ────────────────────────────────
  describe('WebSocket Gateways Real Connections', () => {
    let clientSocket: Socket;

    afterEach(() => {
      if (clientSocket && clientSocket.connected) {
        clientSocket.disconnect();
      }
    });

    it('should authorize socket handshake and reject unauthenticated requests', (done) => {
      // Connect without token
      clientSocket = io(`http://localhost:${port}/chat`, {
        transports: ['websocket'],
        auth: {},
      });

      // Handshake rejection immediately triggers disconnect on client side
      clientSocket.on('disconnect', (reason) => {
        expect(reason).toBeDefined();
        done();
      });
    });

    it('should connect, subscribe, and route messages to correct recipients', async () => {
      const sender = await prisma.user.create({
        data: {
          email: 'sock_sender@pulse.dev',
          username: 'sock_sender',
          password: 'Password123!',
        },
      });
      const receiver = await prisma.user.create({
        data: {
          email: 'sock_rec@pulse.dev',
          username: 'sock_rec',
          password: 'Password123!',
        },
      });

      const tokenSender = await jwt.signAsync({
        sub: sender.id,
        email: sender.email,
      });
      const tokenReceiver = await jwt.signAsync({
        sub: receiver.id,
        email: receiver.email,
      });

      // Create conversation
      const conversation = await prisma.conversation.create({
        data: {
          directKey: [sender.id, receiver.id].sort().join(':'),
          participants: {
            create: [{ userId: sender.id }, { userId: receiver.id }],
          },
        },
      });

      // Connect sender client
      const senderSocket = io(`http://localhost:${port}/chat`, {
        transports: ['websocket'],
        auth: { token: tokenSender },
      });

      // Connect receiver client
      const receiverSocket = io(`http://localhost:${port}/chat`, {
        transports: ['websocket'],
        auth: { token: tokenReceiver },
      });

      await new Promise<void>((resolve) => {
        senderSocket.on('connect', () => {
          receiverSocket.on('connect', () => {
            resolve();
          });
        });
      });

      // Join room
      senderSocket.emit('join_conversation', {
        conversationId: conversation.id,
      });
      receiverSocket.emit('join_conversation', {
        conversationId: conversation.id,
      });

      // Receiver listens for new message
      const messagePromise = new Promise<any>((resolve) => {
        receiverSocket.on('message', (data) => {
          resolve(data);
        });
      });

      // Post message via HTTP
      await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversation.id}/messages`)
        .set('Authorization', `Bearer ${tokenSender}`)
        .send({ content: 'Real-time message payload.' })
        .expect(201);

      const receivedMsg = await messagePromise;
      expect(receivedMsg.content).toBe('Real-time message payload.');

      senderSocket.disconnect();
      receiverSocket.disconnect();
    });
  });

  // ── INFRASTRUCTURE DIAGNOSTIC TESTS ─────────────────────────────
  describe('Infrastructure Integrations', () => {
    it('should verify live health endpoint responses containing database and redis diagnostics', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.services.database).toBe('healthy');
      expect(res.body.services.redis).toBe('healthy');
    });

    it('should verify BullMQ moderation processor manually', async () => {
      const processor = app.get<ModerationProcessor>(ModerationProcessor);
      const user = await prisma.user.create({
        data: {
          email: 'temp_mod@pulse.dev',
          username: 'temp_mod',
          password: 'Password123!',
        },
      });
      const post = await prisma.post.create({
        data: {
          content: 'This is clean and approved content',
          authorId: user.id,
        },
      });

      // Execute processor handler manually
      const jobResult = await processor.handleModerateContent({
        data: {
          targetId: post.id,
          type: 'POST',
          content: post.content,
        },
      } as any);

      expect(jobResult.status).toBe('APPROVED');
      expect(jobResult.targetId).toBe(post.id);

      const updatedPost = await prisma.post.findUnique({
        where: { id: post.id },
      });
      expect(updatedPost?.moderationStatus).toBe(ModerationStatus.APPROVED);
      expect(updatedPost?.moderationReason).toContain('Local Blacklist Check');
    });

    it('should verify Redis operations directly', async () => {
      await redis.set('e2e-test-key', 'e2e-value', 5);
      const val = await redis.get('e2e-test-key');
      expect(val).toBe('e2e-value');
      await redis.del('e2e-test-key');
      const deletedVal = await redis.get('e2e-test-key');
      expect(deletedVal).toBeNull();
    });
  });
});
