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

// Real-feeling developer profiles
const DEVELOPER_TEMPLATES = [
  { username: 'rauchg', displayName: 'Guillermo Rauch', bio: 'CEO at Vercel. Creator of Socket.io, Mongoose, and Next.js. Building the web platform.' },
  { username: 'yyx990803', displayName: 'Evan You', bio: 'Creator of Vue.js, Vite, and Rolldown. Independent open-source developer.' },
  { username: 'dan_abramov', displayName: 'Dan Abramov', bio: 'Co-creator of Redux and Create React App. Working on React Server Components.' },
  { username: 'leerob', displayName: 'Lee Robinson', bio: 'VP of Product at Vercel. Passionate about Next.js, developer tools, and React.' },
  { username: 'rich_harris', displayName: 'Rich Harris', bio: 'Creator of Svelte and Rollup. Graphics editor at NYT. Open source enthusiast.' },
  { username: 'addyosmani', displayName: 'Addy Osmani', bio: 'Engineering Manager at Google Chrome. Author of Learning JavaScript Design Patterns.' },
  { username: 'wesbos', displayName: 'Wes Bos', bio: 'Full stack developer, teacher, podcaster at SyntaxFM. Loving CSS, JS, and node.' },
  { username: 'stolinski', displayName: 'Scott Tolinski', bio: 'Co-host of SyntaxFM. Creator of Level Up Tutorials. Full stack dev and b-boy.' },
  { username: 'mjackson', displayName: 'Michael Jackson', bio: 'Co-creator of React Router and Remix. Building the future of full-stack React.' },
  { username: 'ryanflorence', displayName: 'Ryan Florence', bio: 'Co-creator of Remix and React Router. UX obsessive. Loving building web products.' },
  { username: 'tannerlinsley', displayName: 'Tanner Linsley', bio: 'Creator of TanStack (React Query, Table, Router). CEO of Nozzle. Open-source guy.' },
  { username: 'kentcdodds', displayName: 'Kent C. Dodds', bio: 'Creator of EpicWeb.dev. Remix co-founder. Educator, developer, husband, father.' },
  { username: 'sophiebits', displayName: 'Sophie Alpert', bio: 'Ex-React core team lead. Independent open-source developer and consultant.' },
  { username: 'sebmarkbage', displayName: 'Sebastian Markbåge', bio: 'React core team member, tech lead at Vercel. Shaping UI compilation models.' },
  { username: 'acdlite', displayName: 'Andrew Clark', bio: 'React core team member at Vercel. Co-creator of Redux and Recompose.' },
  { username: 'gaearon', displayName: 'Gaearon Dev', bio: 'Frontend architect exploring hot reloading, fast-refresh, and sandbox runtimes.' },
  { username: 'mcollina', displayName: 'Matteo Collina', bio: 'Fastify co-creator. Node.js TSC member. CTO of Platformatic. Backend specialist.' },
  { username: 'laverdet', displayName: 'Clifton Cunningham', bio: 'Director of Architecture. Scaling Redis cache networks and high-throughput SQL.' },
  { username: 'felixge', displayName: 'Felix Geisendörfer', bio: 'Go contributor and profiler expert. Node-mysql creator. Principal Engineer at Datadog.' },
  { username: 'tjholowaychuk', displayName: 'TJ Holowaychuk', bio: 'Creator of Express, Commander, Koa, Stylus, Apex, and Go libraries.' },
  { username: 'sindresorhus', displayName: 'Sindre Sorhus', bio: 'Full-time open-source developer. Maintaining 1000+ npm packages.' },
  { username: 'swyx', displayName: 'Shawn Wang', bio: 'Founder of Latent Space. Developer advocate. Passionate about AI Engineering.' },
  { username: 'levelsio', displayName: 'Pieter Levels', bio: 'Indie hacker building PhotoAI and NomadList. Scaling businesses with 1 server.' },
  { username: 'dhh', displayName: 'David Heinemeier Hansson', bio: 'Creator of Ruby on Rails. Co-owner of 37signals. Racing driver. Author.' },
  { username: 'spolsky', displayName: 'Joel Spolsky', bio: 'Co-founder of Stack Overflow, Trello, and Fog Creek. Author of Joel on Software.' },
  { username: 'codinghorror', displayName: 'Jeff Atwood', bio: 'Co-founder of Stack Overflow and Discourse. Writer, software developer.' },
  { username: 'wardcunningham', displayName: 'Ward Cunningham', bio: 'Inventor of Wiki, design patterns, and Extreme Programming pioneer.' },
  { username: 'unclebob', displayName: 'Robert C. Martin', bio: 'Author of Clean Code. Agile Manifesto co-author. Software craftsman.' },
  { username: 'martinfowler', displayName: 'Martin Fowler', bio: 'Author, speaker, Refactoring specialist. Chief Scientist at Thoughtworks.' },
  { username: 'jashkenas', displayName: 'Jeremy Ashkenas', bio: 'Creator of CoffeeScript, Backbone.js, and Underscore.js. Interactive developer.' },
  { username: 'schacon', displayName: 'Scott Chacon', bio: 'Co-founder of GitHub. Author of Pro Git. Co-founder of Chatterbug.' },
  { username: 'defunkt', displayName: 'Chris Wanstrath', bio: 'Co-founder and former CEO of GitHub. Loving gaming and building libraries.' },
  { username: 'pjhyett', displayName: 'PJ Hyett', bio: 'Co-founder of GitHub. Software developer and vintage sports car racer.' },
  { username: 'mojombo', displayName: 'Tom Preston-Werner', bio: 'Co-founder of GitHub. Creator of Jekyll, Gravatar, SemVer, and TOML.' },
  { username: 'charlie_dev', displayName: 'Charlie Jenkins', bio: 'Generative AI engineer exploring Gemini Flash and autonomous agent behaviors.' },
  { username: 'alice_vance', displayName: 'Alice Vance', bio: 'Next.js developer & open-source enthusiast. Building responsive UX layouts.' },
  { username: 'bob_builder', displayName: 'Bob Builder', bio: 'Systems engineer specializing in NestJS, Redis, and high-velocity messaging pipes.' },
  { username: 'nest_lover', displayName: 'Kamil Myśliwiec', bio: 'Creator of NestJS. Building progress-driven Node.js backend architectures.' },
  { username: 'typescript_fan', displayName: 'Daniel Rosenwasser', bio: 'Program Manager of TypeScript at Microsoft. Making types delicious.' },
  { username: 'prisma_champion', displayName: 'Johannes Schickling', bio: 'Creator of Prisma. Exploring serverless edge backends and local-first.' },
];

const POST_TEMPLATES = [
  'Next.js 16 App Router is looking incredibly fast. Turbopack compilation times are down to a few milliseconds. Blazing fast! ⚡',
  'Just set up Redis feed caching for the social feeds. Page response times plummeted from 450ms down to 3ms. Scale with caching!',
  'NestJS dependency injection and module scoping make backend design extremely maintainable. Best Node.js framework hands down.',
  'Prisma ORM dynamic schema migrations and typesafe client queries remove 90% of database integration bugs. Love it.',
  'Evaluating Gemini 1.5 Flash toxicity filtering on comments. The latency is quite low, and the 5s timeout guard works beautifully.',
  'State management debate: React Context vs. Zustand. Context is great for simple themes; Zustand shines for dynamic game states.',
  'Has anyone tried Svelte 5 runes yet? The performance improvements are impressive, and reactivity feels very native.',
  'Vite is the best dev server ever built. Change my mind. Instant hot-module replacement makes frontend coding joyful.',
  'WebSockets are excellent for typing indicators and presence, but REST is much easier to secure and test for message posts.',
  'PostgreSQL composite indexes on join tables are critical. Without them, simple follower checks lead to full table scans.',
  'GitHub Actions CI/CD pipelines should run tests, lint, and typecheck concurrently to minimize developer PR cycle times.',
  'Deploying to Vercel + Railway is the sweet spot for modern apps. Edge CDN frontend with a persistent server backend.',
  'Clean Code principles: keep functions small, write descriptive variable names, and don\'t abuse comments. Refactor early.',
  'TypeScript template literal types are incredibly powerful. You can construct complex routing and type-safe systems at build time.',
  'Avoid N+1 queries. Always batch child loads in a single query using Prisma `findMany` with `in` filters. CPU cycles are precious.',
  'Rate limiting is your first line of defense against DoS attacks. Enable it on auth and expensive AI endpoints immediately.',
  'User presence tracking using Redis sets is extremely memory efficient. Card check determines online status instantly.',
  'Is it time to adopt local-first architectures? Offline support and local database sync might be the next paradigm shift.',
  'Tailwind utility classes speed up development, but Vanilla CSS variables are much cleaner for complex themes.',
  'Write unit tests for complex business logics, and E2E integration tests for core user paths. Don\'t chase 100% coverage.',
];

const COMMENT_TEMPLATES = [
  'Total agreement. It completely changes the developer feedback loops.',
  'Interesting approach, but how do you handle cache invalidation?',
  'This is great. Thanks for sharing the detailed code snippets.',
  'Totally worth setting up. The latency reductions are real.',
  'I prefer Zustand because of how clean and selector-driven it is.',
  'Agreed, REST for mutations and Socket.IO for real-time triggers is the best.',
  'Make sure the index is actually being hit. Run EXPLAIN ANALYZE!',
  'TypeScript types are indeed magic once you master them.',
  'This is incredibly clean. Good job on the architecture!',
  'Will try this out in my next project. Thanks for the tip.',
];

async function main() {
  console.log('Starting mega database seeding on:', connectionString);

  // Clean existing tables in order of foreign key dependency
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

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // 1. Create Admin
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

  // 2. Create Users
  const users: any[] = [admin];
  for (const template of DEVELOPER_TEMPLATES) {
    const user = await prisma.user.create({
      data: {
        username: template.username,
        email: `${template.username}@pulse.dev`,
        password: hashedPassword,
        displayName: template.displayName,
        role: Role.USER,
        bio: template.bio,
      },
    });
    users.push(user);
  }
  console.log(`Created ${users.length} users successfully.`);

  // 3. Create Follow relationships (make random networks)
  const followRecords: { followerId: string; followingId: string }[] = [];
  for (const follower of users) {
    // Each user follows 5-10 random users
    const targets = users.filter((u) => u.id !== follower.id);
    const count = 5 + Math.floor(Math.random() * 6);
    const shuffled = targets.sort(() => 0.5 - Math.random()).slice(0, count);

    for (const target of shuffled) {
      followRecords.push({
        followerId: follower.id,
        followingId: target.id,
      });
    }
  }
  await prisma.follow.createMany({ data: followRecords });
  console.log(`Created ${followRecords.length} follow relationships.`);

  // 4. Create Communities
  const webCommunity = await prisma.community.create({
    data: {
      name: 'Web Devs',
      description: 'Discuss Next.js, React, Tailwind, and frontend architectures.',
      ownerId: users[1].id,
      members: {
        create: users.slice(1, 15).map((u, i) => ({
          userId: u.id,
          role: i === 0 ? 'OWNER' : 'MEMBER',
        })),
      },
    },
  });

  const aiCommunity = await prisma.community.create({
    data: {
      name: 'AI Builders',
      description: 'Generative AI models, agent workflows, and LLM orchestration tools.',
      ownerId: users[2].id,
      members: {
        create: users.slice(2, 20).map((u, i) => ({
          userId: u.id,
          role: i === 0 ? 'OWNER' : 'MEMBER',
        })),
      },
    },
  });
  console.log('Created Communities: Web Devs, AI Builders.');

  // 5. Create Posts
  const posts: any[] = [];
  // Generate random posts
  for (let i = 0; i < 60; i++) {
    const author = users[Math.floor(Math.random() * users.length)];
    const content = POST_TEMPLATES[i % POST_TEMPLATES.length] + ` (#${i + 1})`;
    const isWeb = i % 3 === 0;
    const isAi = i % 3 === 1;

    const post = await prisma.post.create({
      data: {
        content,
        authorId: author.id,
        communityId: isWeb ? webCommunity.id : isAi ? aiCommunity.id : null,
        moderationStatus: ModerationStatus.APPROVED,
        createdAt: new Date(Date.now() - i * 4 * 60 * 60 * 1000), // Spaced by 4 hours
      },
    });
    posts.push(post);
  }

  // Create one flagged post
  await prisma.post.create({
    data: {
      content: 'FLAGGED SPAM DO NOT CLICK BUY CRYPTO TOKENS NOW!!!',
      authorId: users[1].id,
      moderationStatus: ModerationStatus.FLAGGED,
      moderationReason: 'Toxicity check failed: contains crypto spam flags',
      moderatedAt: new Date(),
    },
  });
  console.log(`Created ${posts.length} posts.`);

  // 6. Create Comments & Replies
  const comments: any[] = [];
  for (let i = 0; i < 80; i++) {
    const post = posts[Math.floor(Math.random() * posts.length)];
    const user = users[Math.floor(Math.random() * users.length)];
    const content = COMMENT_TEMPLATES[i % COMMENT_TEMPLATES.length];

    const comment = await prisma.comment.create({
      data: {
        content,
        postId: post.id,
        userId: user.id,
        moderationStatus: ModerationStatus.APPROVED,
        createdAt: new Date(post.createdAt.getTime() + (Math.random() * 2 * 60 * 60 * 1000)), // Shortly after post
      },
    });
    comments.push(comment);
  }

  // Create some nested replies
  for (let i = 0; i < 30; i++) {
    const parent = comments[Math.floor(Math.random() * comments.length)];
    const user = users[Math.floor(Math.random() * users.length)];
    const content = 'Agreed! ' + COMMENT_TEMPLATES[i % COMMENT_TEMPLATES.length];

    await prisma.comment.create({
      data: {
        content,
        postId: parent.postId,
        userId: user.id,
        parentId: parent.id,
        moderationStatus: ModerationStatus.APPROVED,
        createdAt: new Date(parent.createdAt.getTime() + (Math.random() * 30 * 60 * 1000)),
      },
    });
  }
  console.log('Created comments and nested replies.');

  // 7. Create Likes and Bookmarks
  const likeRecords: { userId: string; postId: string }[] = [];
  const bookmarkRecords: { userId: string; postId: string }[] = [];

  for (const user of users) {
    // Each user likes 8-15 random posts
    const count = 8 + Math.floor(Math.random() * 8);
    const shuffled = posts.sort(() => 0.5 - Math.random()).slice(0, count);

    for (const post of shuffled) {
      likeRecords.push({
        userId: user.id,
        postId: post.id,
      });
    }

    // Bookmark 2-5 posts
    const bookmarkCount = 2 + Math.floor(Math.random() * 4);
    const bookmarkedShuffled = posts.sort(() => 0.5 - Math.random()).slice(0, bookmarkCount);
    for (const post of bookmarkedShuffled) {
      bookmarkRecords.push({
        userId: user.id,
        postId: post.id,
      });
    }
  }

  // Deduplicate
  const uniqueLikes = Array.from(new Set(likeRecords.map((l) => `${l.userId}_${l.postId}`))).map((s) => {
    const [userId, postId] = s.split('_');
    return { userId, postId };
  });

  const uniqueBookmarks = Array.from(new Set(bookmarkRecords.map((b) => `${b.userId}_${b.postId}`))).map((s) => {
    const [userId, postId] = s.split('_');
    return { userId, postId };
  });

  await prisma.like.createMany({ data: uniqueLikes });
  await prisma.bookmark.createMany({ data: uniqueBookmarks });

  console.log(`Created ${uniqueLikes.length} likes and ${uniqueBookmarks.length} bookmarks.`);
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
