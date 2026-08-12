import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';

@Processor('email-queue')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  @Process('sendWelcomeEmail')
  async handleSendWelcomeEmail(job: Job<{ email: string; username: string }>) {
    const { email, username } = job.data;
    this.logger.log(`[Email Job Start] Sending welcome email to ${email}`);

    // Simulate SMTP delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.logger.log(
      `[Email Job Success] Welcome email successfully sent to ${email} (username: ${username})`,
    );
    return { status: 'sent', recipient: email };
  }
}
