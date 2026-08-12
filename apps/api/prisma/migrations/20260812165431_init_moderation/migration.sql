-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'FLAGGED', 'REJECTED');

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'PENDING';
