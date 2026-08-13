-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "moderated_at" TIMESTAMP(3),
ADD COLUMN     "moderation_reason" TEXT;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "moderated_at" TIMESTAMP(3),
ADD COLUMN     "moderation_reason" TEXT;
