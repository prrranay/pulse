import { PrismaClient, Role, ModerationStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables explicitly from apps/api/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not defined.');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seeding database on connection:', connectionString);

  // Clean existing data in order of dependency
  await prisma.notification.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.like.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.repost.deleteMany();
  await prisma.communityMember.deleteMany();
  await prisma.post.deleteMany();
  await prisma.community.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.user.deleteMany();

  // Create hashed password
  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // 1. Create Users
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@pulse.dev',
      password: hashedPassword,
      displayName: 'System Admin',
      role: Role.ADMIN,
      bio: 'Pulse command center operator. Managing safety policies and system overrides.',
    },
  });

  const alice = await prisma.user.create({
    data: {
      username: 'alice',
      email: 'alice@pulse.dev',
      password: hashedPassword,
      displayName: 'Alice Vance',
      role: Role.USER,
      bio: 'Next.js developer & open-source enthusiast. Building responsive UX layouts.',
    },
  });

  const bob = await prisma.user.create({
    data: {
      username: 'bob',
      email: 'bob@pulse.dev',
      password: hashedPassword,
      displayName: 'Bob Builder',
      role: Role.USER,
      bio: 'Systems engineer specializing in NestJS, Redis, and high-velocity messaging pipes.',
    },
  });

  const charlie = await prisma.user.create({
    data: {
      username: 'charlie',
      email: 'charlie@pulse.dev',
      password: hashedPassword,
      displayName: 'Charlie Tech',
      role: Role.USER,
      bio: 'Generative AI engineer exploring Gemini Flash and autonomous agent behaviors.',
    },
  });

  console.log('Created Users:', {
    admin: admin.username,
    alice: alice.username,
    bob: bob.username,
    charlie: charlie.username,
  });

  // 2. Create Follow relationships
  await prisma.follow.createMany({
    data: [
      { followerId: alice.id, followingId: bob.id },
      { followerId: bob.id, followingId: alice.id },
      { followerId: charlie.id, followingId: alice.id },
      { followerId: charlie.id, followingId: bob.id },
    ],
  });

  // 3. Create Communities
  const webCommunity = await prisma.community.create({
    data: {
      name: 'Web Devs',
      description: 'Discuss Next.js, React, Tailwind, and frontend architectures.',
      ownerId: alice.id,
      members: {
        create: [
          { userId: alice.id, role: 'OWNER' },
          { userId: bob.id, role: 'MEMBER' },
          { userId: charlie.id, role: 'MEMBER' },
        ],
      },
    },
  });

  const aiCommunity = await prisma.community.create({
    data: {
      name: 'AI Builders',
      description: 'Generative AI models, agent workflows, and LLM orchestration tools.',
      ownerId: charlie.id,
      members: {
        create: [
          { userId: charlie.id, role: 'OWNER' },
          { userId: alice.id, role: 'MEMBER' },
          { userId: bob.id, role: 'MEMBER' },
        ],
      },
    },
  });

  console.log('Created Communities:', [webCommunity.name, aiCommunity.name]);

  // 4. Create Posts
  const post1 = await prisma.post.create({
    data: {
      content: 'Next.js 16 is looking incredible. React Server Components and Turbopack compiler speeds make local development blazing fast! ⚡',
      authorId: alice.id,
      communityId: webCommunity.id,
      moderationStatus: ModerationStatus.APPROVED,
    },
  });

  const post2 = await prisma.post.create({
    data: {
      content: 'Just set up Redis feed caching for Pulse. Decreased average load time of personalized home feeds down to 2ms. Caching layers are key for modern system design.',
      authorId: bob.id,
      moderationStatus: ModerationStatus.APPROVED,
    },
  });

  const post3 = await prisma.post.create({
    data: {
      content: 'Integrating Gemini 1.5 Flash directly in our NestJS services. The 5-second AbortController timeout guard works perfectly as a fallback block. highly recommend!',
      authorId: charlie.id,
      communityId: aiCommunity.id,
      moderationStatus: ModerationStatus.APPROVED,
    },
  });

  await prisma.post.create({
    data: {
      content: 'DUMMY SPAM BUY BITCOIN FAST CRYPTO SCAM 100x GUARANTEED!!!',
      authorId: bob.id,
      moderationStatus: ModerationStatus.FLAGGED,
    },
  });

  console.log('Created Posts');

  // 5. Create Comments & Replies
  const comment1 = await prisma.comment.create({
    data: {
      content: 'Total agreement. Turbopack hot reload is instantaneous.',
      postId: post1.id,
      userId: bob.id,
      moderationStatus: ModerationStatus.APPROVED,
    },
  });

  await prisma.comment.create({
    data: {
      content: 'Right? It completely changes the developer feedback loops.',
      postId: post1.id,
      userId: alice.id,
      parentId: comment1.id,
      moderationStatus: ModerationStatus.APPROVED,
    },
  });

  await prisma.comment.create({
    data: {
      content: 'Are you using Redis cluster mode or a standalone node?',
      postId: post2.id,
      userId: charlie.id,
      moderationStatus: ModerationStatus.APPROVED,
    },
  });

  console.log('Created Comments and Replies');

  // 6. Create Likes and Bookmarks
  await prisma.like.createMany({
    data: [
      { userId: bob.id, postId: post1.id },
      { userId: charlie.id, postId: post1.id },
      { userId: alice.id, postId: post2.id },
      { userId: charlie.id, postId: post2.id },
    ],
  });

  await prisma.bookmark.createMany({
    data: [
      { userId: alice.id, postId: post2.id },
      { userId: bob.id, postId: post3.id },
    ],
  });

  console.log('Database Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
