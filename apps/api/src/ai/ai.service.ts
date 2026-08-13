import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey?: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!this.apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY environment variable is not defined. Falling back to mock/local models.',
      );
    }
  }

  /**
   * Refines draft text using Gemini Flash, with timeout and error fallback.
   */
  async refineText(
    text: string,
    tone: 'improve' | 'concise' | 'professional' | 'engaging',
  ): Promise<string> {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return '';
    }

    const prompts = {
      improve: `Improve the clarity, flow, and grammar of this text while maintaining its core meaning. Return ONLY the improved text, without quotes or additional comments: "${trimmedText}"`,
      concise: `Rewrite this text to be short, direct, and concise. Omit unnecessary words. Return ONLY the concise text, without quotes or additional comments: "${trimmedText}"`,
      professional: `Rewrite this text to have a highly professional, polite, and business-appropriate tone. Return ONLY the professional text, without quotes or additional comments: "${trimmedText}"`,
      engaging: `Rewrite this text to be highly engaging, exciting, and interesting for readers on a technical social platform. Return ONLY the engaging text, without quotes or additional comments: "${trimmedText}"`,
    };

    const promptText = prompts[tone] || prompts.improve;

    if (!this.apiKey) {
      this.logger.log(
        `[AI Refine Fallback] API key missing. Running local fallback for tone "${tone}".`,
      );
      return this.localRefineFallback(trimmedText, tone);
    }

    try {
      this.logger.log(
        `[AI Refine Request] Sending content to Gemini Flash for tone "${tone}".`,
      );
      const result = await this.callGeminiApi(promptText);
      if (result) {
        return result.trim();
      }
      throw new Error('Empty response from Gemini');
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `[AI Refine Failed] Call failed: ${error.message}. Triggering local fallback.`,
      );
      return this.localRefineFallback(trimmedText, tone);
    }
  }

  /**
   * Moderates post or comment content using Gemini Flash, returning PENDING, APPROVED, FLAGGED, or REJECTED.
   */
  async moderateContent(
    content: string,
  ): Promise<'APPROVED' | 'FLAGGED' | 'REJECTED'> {
    const trimmed = content.trim();
    if (!trimmed) {
      return 'APPROVED';
    }

    const moderationPrompt = `You are an AI safety moderator for a technical developer social network called Pulse.
Analyze the following content for spam, toxicity, offensive slurs, cybersecurity hacks, credentials leaks, or abuse.
Choose one status code to classify this content and return ONLY that word:
- APPROVED (completely safe)
- FLAGGED (suspicious, needs review, minor violation)
- REJECTED (severe violation, offensive language, spam link)

Content to analyze:
"${trimmed}"

Decision (APPROVED, FLAGGED, or REJECTED):`;

    if (!this.apiKey) {
      this.logger.log(
        '[AI Moderation Fallback] API key missing. Running local rule-based safety checks.',
      );
      return this.localModerationFallback(trimmed);
    }

    try {
      this.logger.log(
        '[AI Moderation Request] Running safety checks via Gemini Flash.',
      );
      const result = await this.callGeminiApi(moderationPrompt);
      const cleanResult = result.trim().toUpperCase();

      if (['APPROVED', 'FLAGGED', 'REJECTED'].includes(cleanResult)) {
        return cleanResult as 'APPROVED' | 'FLAGGED' | 'REJECTED';
      }

      this.logger.warn(
        `[AI Moderation Query] Unexpected response value: ${cleanResult}. Defaulting to FLAGGED.`,
      );
      return 'FLAGGED';
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `[AI Moderation Failed] Safety check error: ${error.message}. Falling back to local rules.`,
      );
      return this.localModerationFallback(trimmed);
    }
  }

  /**
   * Helper calling Google Generative AI REST API with a 5-second timeout guard.
   */
  private async callGeminiApi(promptText: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: promptText,
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error status ${response.status}`);
      }

      const data: unknown = await response.json();
      const dataObj = data as Record<string, unknown>;
      const candidates = dataObj.candidates as
        Array<Record<string, unknown>> | undefined;
      const firstCandidate = candidates?.[0];
      const contentObj = firstCandidate?.content as
        Record<string, unknown> | undefined;
      const parts = contentObj?.parts as
        Array<Record<string, unknown>> | undefined;
      const text = parts?.[0]?.text as string | undefined;

      if (typeof text !== 'string') {
        throw new Error('Invalid JSON shape returned by Gemini API');
      }

      return text;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Fallback rule-based refinement if API is down or missing key.
   */
  private localRefineFallback(text: string, tone: string): string {
    switch (tone) {
      case 'concise':
        // Trim down text to max 80 characters
        return text.length > 80 ? `${text.slice(0, 77)}...` : text;
      case 'professional':
        // Standard professional prefix
        return `Hello network, I wanted to share this update: ${text}`;
      case 'engaging':
        // Add excitement emojis/indicators
        return `🔥 Check this out! ${text} 🚀 #developers #pulse`;
      default:
        // 'improve'
        return text;
    }
  }

  /**
   * Local rule-based blacklist safety checks if API is down or missing key.
   */
  private localModerationFallback(
    text: string,
  ): 'APPROVED' | 'FLAGGED' | 'REJECTED' {
    const blacklist = ['offensive', 'hack', 'malware', 'abuse'];

    const containsViolatingContent = blacklist.some((keyword) =>
      new RegExp(`\\b${keyword}\\b`, 'i').test(text),
    );
    if (containsViolatingContent) {
      // Moderate severity keyword match is FLAGGED, extreme spam is REJECTED
      const hasOffensive = new RegExp('\\boffensive\\b', 'i').test(text);
      const hasHack = new RegExp('\\bhack\\b', 'i').test(text);
      if (hasOffensive || hasHack) {
        return 'REJECTED';
      }
      return 'FLAGGED';
    }

    return 'APPROVED';
  }
}
