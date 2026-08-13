import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GEMINI_API_KEY') return null; // No API key configured
              if (key === 'GEMINI_MODEL') return 'gemini-1.5-flash';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('refineText', () => {
    it('should throw ServiceUnavailableException when GEMINI_API_KEY is not configured', async () => {
      await expect(service.refineText('Hello', 'improve')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('moderateContent', () => {
    it('should run local blacklist fallback and return structured status/reason when GEMINI_API_KEY is missing', async () => {
      const cleanContent = await service.moderateContent('Hello world this is safe');
      expect(cleanContent.status).toBe('APPROVED');
      expect(cleanContent.reason).toContain('Local Blacklist Check');

      const hackContent = await service.moderateContent('this content is a hack tool');
      expect(hackContent.status).toBe('REJECTED');
      expect(hackContent.reason).toContain('Local Blacklist Check');
    });
  });
});
