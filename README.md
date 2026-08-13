# Pulse — Developer Social Platform

Pulse is a high-performance, production-oriented developer social platform built to demonstrate advanced system architecture, real-time communications, scalable caching paradigms, and asynchronous background jobs.

---

## Architecture Diagrams

### 1. Real-Time Chat Flow
```mermaid
sequenceDiagram
    participant Sender as Client A
    participant Gateway as Socket.IO Gateway
    participant Guard as Auth Guard
    participant DB as PostgreSQL
    participant Recipient as Client B

    Sender->>Gateway: emit("sendMessage", payload)
    Gateway->>Guard: Validate Handshake JWT & Room membership
    alt Unauthorized
        Guard-->>Sender: emit("error", Unauthorized)
    else Authorized
        Guard->>DB: Save Message & Update Conversation
        DB-->>Gateway: Persisted Message
        Gateway->>Recipient: emit("message", messagePayload)
    end
```

### 2. Live Notification Dispatch
```mermaid
flowchart TD
    Action[User Interaction: Like/Comment/Follow] --> NestJS[NestJS Controller]
    NestJS --> DB[Save Notification in PostgreSQL]
    DB --> Gateway[Socket.IO Gateway]
    Gateway --> Socket[Emit live event to user room: user_userId]
    Socket --> Client[Recipient UI updates instantly]
```

### 3. Asynchronous Background Jobs (BullMQ)
```mermaid
flowchart LR
    API[Client API Request] --> DB[Save initial Post/Comment state]
    DB --> Queue[BullMQ Queue]
    Queue --> Job[Job Store: Redis]
    Job --> Worker[Moderation/Email Worker]
    Worker --> AI[Gemini Flash Safety Classification]
    AI --> UpdateDB[Update status APPROVED/FLAGGED in PostgreSQL]
```

---

## Tech Stack & Architecture

### Frontend Workspace
- **Core**: Next.js 16 (App Router), React 19, TypeScript
- **State & Fetching**: React Query (TanStack Query) for query caching and optimistic mutations
- **Styling**: Vanilla CSS with curated dark glassmorphism styling
- **Real-Time Client**: Socket.io Client for notification rooms

### Backend Workspace
- **Core**: NestJS (TypeScript), Passport JWT, class-validator
- **Database**: PostgreSQL with Prisma ORM
- **Cache & Telemetry**: Redis (ioredis) managing rate limits, presence trackers, and feed caches
- **Queue**: BullMQ registered on Redis pools for transactional runners

---

## Core Engineering Decisions

### Why PostgreSQL?
We chose PostgreSQL as the primary transactional source of truth due to its strict ACID compliance, relational integrity (foreign keys, cascading deletes), and robust indexing. Complex relationships like followers/following, post interactions (likes, bookmarks), and communities are mapped natively with indexes on constraint keys.

### Why Redis?
Redis serves three critical system needs:
1. **Low-Latency Feed Caching**: Home feeds are cached with a 120s TTL and invalidated instantly on new posts.
2. **Atomic Rate Limiting**: Avoids query overhead on DB by tracking window thresholds using atomic transactions.
3. **Real-Time Presence**: Keeps track of active Socket.IO connections.

### Why BullMQ?
Heavy auxiliary tasks (AI Content Moderation checks, Transactional Welcome Emails) are executed out-of-band to prevent bottlenecking the core client response. BullMQ provides Redis-backed queues offering message durability, retry strategies, backoff configurations, and concurrent worker threads.

### Why Socket.IO?
Socket.IO provides persistent duplex connections with fallback to HTTP long-polling, room-based broadcast mechanisms, and auto-reconnection filters. This makes dispatching real-time notifications and chat updates highly reliable.

### Why Cursor-Based Pagination?
Using traditional `OFFSET` pagination causes database query performance to degrade at scale (as Postgres must scan all previous records). Pulse implements **Cursor-Based Pagination** using unique post IDs as cursors. This ensures $O(1)$ query execution times regardless of feed depth.

### Why separate frontend and backend?
Pulse separates the frontend (Next.js) and backend (NestJS) workspaces to optimize compile times, decouple rendering from business logic, and enable independent horizontal scaling of frontend static page caches and backend transaction workers.

---

## AI Architecture & Safety Filters

Pulse integrates the **Google Gemini 1.5 Flash API** for writing refinements and safety moderation checks:
- **Assistant Refinement**: Draft tone adjusters ("Improve", "Concise", "Professional", "Engaging") use specialized system prompts.
- **Asynchronous Safety Check**: Moderation safety jobs classify text into `APPROVED`, `FLAGGED`, or `REJECTED` states. Flagged items receive prefix banners, and rejected items are removed.
- **Availability Guard**: Every AI request is wrapped in a strict **5-second timeout** using `AbortController`. If Gemini fails or keys are missing, the service falls back to a local keyword-blacklist regex scan and standard string format helpers.

---

## Rate Limiting Thresholds

The custom `RateLimiterGuard` applies limits based on client IP or user ID:
- **Authentication (`/auth/login`, `/auth/register`)**: Max 5 requests per minute (TTL: 60s).
- **Post creation (`/posts`)**: Max 20 requests per minute.
- **Comment creation (`/posts/:id/comments`)**: Max 20 requests per minute.
- **AI Refinement (`/ai/refine`)**: Max 10 requests per minute.

---

## Environment Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | NestJS API Port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:123456@localhost:5432/pulse` |
| `REDIS_URL` | Redis server address | `redis://localhost:6379` |
| `JWT_SECRET` | Secret signature for authorization tokens | `pulse_jwt_secret_anchor_2026` |
| `GEMINI_API_KEY` | Google Generative AI access key | *Optional (triggers fallbacks if missing)* |

---

## Local Development Guide

### 1. Prerequisite Installations
Ensure PostgreSQL, Redis, and Node.js (v18+) are running locally.

### 2. Setup Database & Sync Client
```bash
# Clone the repository
cd pulse

# Install all monorepo dependencies
npm install

# Run Prisma schema migrations and generate client
npm run db:migrate
npm run db:generate
```

### 3. Run Services Concurrently
```bash
# Boot Next.js and NestJS concurrently
npm run dev
```
- Frontend starts at: `http://localhost:3000`
- Backend API starts at: `http://localhost:4000/api/v1`

### 4. Running the Test Suite
```bash
# Run unit and integration tests
npm test
```

## Admin Dashboard Metrics & Analytics

The admin panel displays platform metrics with strict technical honesty:
- **Active Users**: Users who performed authenticated activity (e.g. logging in, creating/reading posts, fetching feeds, sending chat messages) in the past 30 days, tracked via `lastActiveAt` database updates (throttled to a maximum of 1 write per user per 15 minutes to prevent excessive writes).
- **Total Posts**: Count of public platform posts that are successfully `APPROVED` (rejected content is omitted).
- **Total Comments**: Count of public platform comments that are successfully `APPROVED` (rejected content is omitted).
- **Total Messages**: The real-time database count of all direct chat messages sent.

---

## Known Trade-offs & Future Improvements

1. **Local AI Fallbacks**: Blacklist keywords regex parsing is simple and doesn't capture nuanced context. Integrations with lightweight local classifiers (e.g. natural lang processors) could replace regex checks.
2. **Media Uploads**: Post composer supports media URL binding, but direct binary image uploads are bypassed. Adding S3/Cloudinary storage streams inside a BullMQ `media-queue` is a future optimization.