import { prisma } from '../../../infrastructure/database/prisma';
import { BusinessException } from '../../../common/exception/business-exception';
import { ErrorCode } from '../../../common/exception/error-code';
import { createAiProvider, createMockProvider, AiProvider, AiUnavailableError } from './ai-provider';
import { AiDraftRequest, AiRewriteRequest, AiSummaryRequest } from '../dto/ai.dto';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class AiService {
  private provider: AiProvider | null;
  private providerError: string | null;
  private rateLimits: Map<number, RateLimitEntry> = new Map();
  private readonly MAX_REQUESTS_PER_MINUTE = 10;

  constructor(injectedProvider?: AiProvider) {
    if (injectedProvider) {
      // Test injection: use the provided provider directly
      this.provider = injectedProvider;
      this.providerError = null;
    } else {
      try {
        this.provider = createAiProvider();
        this.providerError = null;
      } catch (err) {
        if (err instanceof AiUnavailableError) {
          this.provider = null;
          this.providerError = err.message;
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Check if AI service is available. Throws 503 if not.
   */
  private ensureAvailable(): void {
    if (!this.provider) {
      throw BusinessException.serviceUnavailable(
        ErrorCode.AI_SERVICE_UNAVAILABLE,
        this.providerError || 'AI服务暂不可用'
      );
    }
  }

  // ========================
  // Rate limiting check
  // ========================
  private checkRateLimit(userId: number): void {
    const now = Date.now();
    const entry = this.rateLimits.get(userId);

    if (!entry || now > entry.resetTime) {
      this.rateLimits.set(userId, { count: 1, resetTime: now + 60_000 });
      return;
    }

    if (entry.count >= this.MAX_REQUESTS_PER_MINUTE) {
      throw BusinessException.badRequest(
        ErrorCode.AI_RATE_LIMIT_EXCEEDED,
        'AI请求过于频繁，请稍后再试'
      );
    }

    entry.count++;
  }

  // ========================
  // Generate draft
  // ========================
  async generateDraft(userId: number, dto: AiDraftRequest) {
    this.ensureAvailable();
    this.checkRateLimit(userId);

    const content = await this.provider!.generateDraft(dto.topic, dto.points, dto.requirements);
    return { content };
  }

  // ========================
  // Rewrite text
  // ========================
  async rewriteText(userId: number, dto: AiRewriteRequest) {
    this.ensureAvailable();
    this.checkRateLimit(userId);

    const content = await this.provider!.rewriteText(dto.selectedText, dto.mode);
    return { content };
  }

  // ========================
  // Generate summary
  // ========================
  async generateSummary(userId: number, dto: AiSummaryRequest) {
    this.ensureAvailable();
    this.checkRateLimit(userId);

    const content = await this.provider!.generateSummary(dto.content);
    return { content };
  }

  // ========================
  // Query knowledge base
  // ========================
  async queryKnowledge(userId: number, question: string) {
    this.ensureAvailable();
    this.checkRateLimit(userId);

    // Search PUBLISHED articles by title first, then content
    let articles = await prisma.knowledgeArticle.findMany({
      where: {
        status: 'PUBLISHED',
        title: { contains: question },
      },
      take: 5,
      select: { id: true, title: true, content: true },
    });

    if (articles.length === 0) {
      articles = await prisma.knowledgeArticle.findMany({
        where: {
          status: 'PUBLISHED',
          content: { contains: question },
        },
        take: 5,
        select: { id: true, title: true, content: true },
      });
    }

    if (articles.length === 0) {
      throw BusinessException.badRequest(ErrorCode.AI_QUERY_NO_RESULTS, '未找到相关知识库文章');
    }

    const references = articles.map((a) => ({
      title: a.title,
      content: a.content,
    }));

    const answer = await this.provider!.answerQuestion(question, references);

    return {
      answer,
      sources: articles.map((a) => ({
        articleId: a.id,
        title: a.title,
      })),
    };
  }
}

// Lazy singleton: don't throw at import time, throw at request time if unavailable
let _instance: AiService | null = null;
export function getAiService(): AiService {
  if (!_instance) _instance = new AiService();
  return _instance;
}
