-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL,
ADD COLUMN "google_id" TEXT;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN "image_public_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
