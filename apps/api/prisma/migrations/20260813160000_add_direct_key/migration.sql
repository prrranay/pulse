-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "direct_key" TEXT;

-- Populate existing 1-to-1 conversations
UPDATE conversations c
SET direct_key = sub.key
FROM (
  SELECT conversation_id,
         CASE 
           WHEN MIN(user_id) < MAX(user_id) THEN MIN(user_id) || ':' || MAX(user_id)
           ELSE MAX(user_id) || ':' || MIN(user_id)
         END as key
  FROM conversation_participants
  GROUP BY conversation_id
  HAVING COUNT(user_id) = 2
) sub
WHERE c.id = sub.conversation_id;

-- CreateIndex
CREATE UNIQUE INDEX "conversations_direct_key_key" ON "conversations"("direct_key");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");
