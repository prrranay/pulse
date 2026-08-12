import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { ModerationStatus } from '@prisma/client';

interface ModerationPayload {
  targetId: string;
  type: 'POST' | 'COMMENT';
  content: string;
}

@Processor('moderation-queue')
export class ModerationProcessor {
  private readonly logger = new Logger(ModerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  @Process('moderateContent')
  async handleModerateContent(job: Job<ModerationPayload>) {
    const { targetId, type, content } = job.data;
    this.logger.log(
      `[Moderation Job Start] AI Safety check on ${type} with ID ${targetId}`,
    );

    try {
      // Evaluate content via Gemini Flash safety classifier
      const statusResult = await this.aiService.moderateContent(content);
      this.logger.log(
        `[Moderation Job Query] Gemini Flash safety outcome: ${statusResult}`,
      );

      // Map safety status to Prisma enum
      let status: ModerationStatus = ModerationStatus.APPROVED;
      if (statusResult === 'FLAGGED') {
        status = ModerationStatus.FLAGGED;
      } else if (statusResult === 'REJECTED') {
        status = ModerationStatus.REJECTED;
      }

      // Update database status and prepend warning banner if flagged
      if (type === 'POST') {
        const post = await this.prisma.post.findUnique({
          where: { id: targetId },
        });
        if (post) {
          const updatedContent =
            status === ModerationStatus.APPROVED
              ? post.content
              : `[FLAGGED - SENSITIVE CONTENT] ${post.content}`;

          await this.prisma.post.update({
            where: { id: targetId },
            data: {
              moderationStatus: status,
              content: updatedContent,
            },
          });
        }
      } else if (type === 'COMMENT') {
        const comment = await this.prisma.comment.findUnique({
          where: { id: targetId },
        });
        if (comment) {
          const updatedContent =
            status === ModerationStatus.APPROVED
              ? comment.content
              : `[FLAGGED - SENSITIVE COMMENT] ${comment.content}`;

          await this.prisma.comment.update({
            where: { id: targetId },
            data: {
              moderationStatus: status,
              content: updatedContent,
            },
          });
        }
      }

      this.logger.log(
        `[Moderation Job Success] ${type} ID ${targetId} processed. Status set to: ${status}`,
      );
      return { status, targetId };
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `[Moderation Job Error] Failed to moderate: ${error.message}`,
      );
      throw error; // Let BullMQ retry this job based on backoff config
    }
  }
}
export type { ModerationPayload };
