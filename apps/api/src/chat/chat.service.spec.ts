import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from './chat.gateway';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { ForbiddenException } from '@nestjs/common';
import { User } from '@prisma/client';

describe('ChatService - Direct Conversations Integration', () => {
  let chatService: ChatService;
  let prisma: PrismaService;
  let userA: User;
  let userB: User;

  // Mock Gateways
  const mockChatGateway = {
    server: {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    },
  };
  const mockNotificationsGateway = {
    server: {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        PrismaService,
        { provide: ChatGateway, useValue: mockChatGateway },
        { provide: NotificationsGateway, useValue: mockNotificationsGateway },
      ],
    }).compile();

    chatService = module.get<ChatService>(ChatService);
    prisma = module.get<PrismaService>(PrismaService);

    // Ensure database connection
    await prisma.$connect();

    // Clean up if previous run left test users
    await cleanup();

    // Create test users
    userA = await prisma.user.create({
      data: {
        username: 'test_user_a_unique',
        email: 'user_a_unique@test.dev',
        password: 'Password123!',
        displayName: 'User A',
      },
    });

    userB = await prisma.user.create({
      data: {
        username: 'test_user_b_unique',
        email: 'user_b_unique@test.dev',
        password: 'Password123!',
        displayName: 'User B',
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: {
        username: { in: ['test_user_a_unique', 'test_user_b_unique'] },
      },
    });

    if (users.length === 2) {
      const key = users
        .map((u) => u.id)
        .sort()
        .join(':');
      await prisma.conversation.deleteMany({
        where: { directKey: key },
      });
    }

    // Delete test users
    await prisma.user.deleteMany({
      where: {
        username: { in: ['test_user_a_unique', 'test_user_b_unique'] },
      },
    });
  }

  it('should prevent a user from creating a conversation with themselves', async () => {
    await expect(
      chatService.getOrCreateConversation(userA.id, userA.username),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should create a conversation and return the same ID for A -> B and B -> A', async () => {
    // A -> B
    const conv1 = await chatService.getOrCreateConversation(
      userA.id,
      userB.username,
    );
    expect(conv1.id).toBeDefined();
    expect(conv1.otherParticipant.id).toBe(userB.id);

    // B -> A
    const conv2 = await chatService.getOrCreateConversation(
      userB.id,
      userA.username,
    );
    expect(conv2.id).toBe(conv1.id);
    expect(conv2.otherParticipant.id).toBe(userA.id);
  });

  it('should gracefully handle concurrent creation races using the directKey constraint', async () => {
    // Delete conversation to ensure they are created concurrently
    const key = [userA.id, userB.id].sort().join(':');
    await prisma.conversation.deleteMany({
      where: { directKey: key },
    });

    // Run creation concurrently
    const [c1, c2] = await Promise.all([
      chatService.getOrCreateConversation(userA.id, userB.username),
      chatService.getOrCreateConversation(userB.id, userA.username),
    ]);

    expect(c1.id).toBeDefined();
    expect(c2.id).toBe(c1.id);

    // Verify exactly one conversation exists for this directKey
    const count = await prisma.conversation.count({
      where: { directKey: key },
    });
    expect(count).toBe(1);
  });
});
