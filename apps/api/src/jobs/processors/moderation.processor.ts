import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';

interface ModerationPayload {
  targetId: string;
  type: 'POST' | 'COMMENT';
  content: string;
}

@Processor('moderation-queue')
export class ModerationProcessor {
  private readonly logger = new Logger(ModerationProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('moderateContent')
  async handleModerateContent(job: Job<ModerationPayload>) {
    const { targetId, type, content } = job.data;
    this.logger.log(
      `[Moderation Job Start] Checking ${type} with ID ${targetId}`,
    );

    // Simulate AI moderation check delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Simple rule-based sensitive keywords blacklist
    const blacklist = ['offensive', 'spam', 'hack', 'malware', 'abuse'];
    const lowerContent = content.toLowerCase();
    const containsViolatingContent = blacklist.some((keyword) =>
      lowerContent.includes(keyword),
    );

    if (containsViolatingContent) {
      this.logger.warn(
        `[Moderation Flagged] ${type} ID ${targetId} contains forbidden content. Actioning.`,
      );

      // Perform moderation action in database (prepend flag)
      if (type === 'POST') {
        const post = await this.prisma.post.findUnique({
          where: { id: targetId },
        });
        if (post) {
          await this.prisma.post.update({
            where: { id: targetId },
            data: {
              content: `[FLAGGED - SENSITIVE CONTENT] ${post.content}`,
            },
          });
        }
      } else if (type === 'COMMENT') {
        const comment = await this.prisma.comment.findUnique({
          where: { id: targetId },
        });
        if (comment) {
          await this.prisma.comment.update({
            where: { id: targetId },
            data: {
              content: `[FLAGGED - SENSITIVE COMMENT] ${comment.content}`,
            },
          });
        }
      }

      return { status: 'flagged', targetId };
    }

    this.logger.log(
      `[Moderation Job Success] ${type} ID ${targetId} passed safety checks.`,
    );
    return { status: 'approved', targetId };
  }
}
export type { ModerationPayload };
