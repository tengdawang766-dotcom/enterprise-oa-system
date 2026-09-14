import { prisma } from '../../../infrastructure/database/prisma';
import { BusinessException } from '../../../common/exception/business-exception';
import { ErrorCode } from '../../../common/exception/error-code';
import { createAiProvider, createMockProvider, AiProvider, AiUnavailableError } from './ai-provider';
import { AiDraftRequest, AiRewriteRequest, AiSummaryRequest } from '../dto/ai.dto';

// ============================================================
// Configuration — env-overridable defaults
// ============================================================
const AI_MAX_PER_MINUTE = parseInt(process.env.AI_MAX_PER_MINUTE || '10', 10);
const AI_MAX_CONCURRENT = parseInt(process.env.AI_MAX_CONCURRENT || '3', 10);
const AI_DAILY_QUOTA = parseInt(process.env.AI_DAILY_QUOTA || '50', 10);

// ============================================================
// Per-user tracking structures
// ============================================================
interface RateLimitEntry {
  count: number;
  resetTime: number;  // epoch ms when the per-minute window resets
}

interface DailyQuotaEntry {
  count: number;
  day: string;        // YYYY-MM-DD of the quota day
}

// ============================================================
// AiService
// ============================================================
export class AiService {
  private provider: AiProvider | null;
  private providerError: string | null;

  // Per-minute rate limiting
  private rateLimits: Map<number, RateLimitEntry> = new Map();

  // Per-day quota
  private dailyQuotas: Map<number, DailyQuotaEntry> = new Map();

  // Concurrency tracking: userId → count of in-flight requests
  private activeRequests: Map<number, number> = new Map();

  constructor(injectedProvider?: AiProvider) {
    if (injectedProvider) {
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

  // ========================
  // Availability check
  // ========================
  private ensureAvailable(): void {
    if (!this.provider) {
      throw BusinessException.serviceUnavailable(
        ErrorCode.AI_SERVICE_UNAVAILABLE,
        this.providerError || 'AI服务暂不可用'
      );
    }
  }

  // ========================
  // Per-minute rate limiting
  // ========================
  private checkRateLimit(userId: number): void {
    const now = Date.now();
    const entry = this.rateLimits.get(userId);

    if (!entry || now > entry.resetTime) {
      this.rateLimits.set(userId, { count: 1, resetTime: now + 60_000 });
      return;
    }

    if (entry.count >= AI_MAX_PER_MINUTE) {
      throw BusinessException.badRequest(
        ErrorCode.AI_RATE_LIMIT_EXCEEDED,
        `AI请求过于频繁，每分钟最多${AI_MAX_PER_MINUTE}次`
      );
    }

    entry.count++;
  }

  // ========================
  // Daily quota
  // ========================
  private checkDailyQuota(userId: number): void {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const entry = this.dailyQuotas.get(userId);

    if (!entry || entry.day !== today) {
      // New day or first request — reset
      this.dailyQuotas.set(userId, { count: 1, day: today });
      return;
    }

    if (entry.count >= AI_DAILY_QUOTA) {
      throw BusinessException.badRequest(
        ErrorCode.AI_RATE_LIMIT_EXCEEDED,
        `已达到今日AI使用上限（${AI_DAILY_QUOTA}次/天），请明天再试`
      );
    }

    entry.count++;
  }

  // ========================
  // Concurrency cap
  // ========================
  private acquireSlot(userId: number): void {
    const current = this.activeRequests.get(userId) || 0;
    if (current >= AI_MAX_CONCURRENT) {
      throw BusinessException.badRequest(
        ErrorCode.AI_REQUEST_IN_PROGRESS,
        `AI并发请求已达上限（${AI_MAX_CONCURRENT}个），请等待当前请求完成`
      );
    }
    this.activeRequests.set(userId, current + 1);
  }

  private releaseSlot(userId: number): void {
    const current = this.activeRequests.get(userId) || 0;
    if (current <= 1) {
      this.activeRequests.delete(userId);
    } else {
      this.activeRequests.set(userId, current - 1);
    }
  }

  // ========================
  // User + article re-validation (for queryKnowledge)
  // ========================
  private async revalidateUser(userId: number): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, tokenVersion: true },
    });

    if (!user || user.status === 'DISABLED') {
      throw BusinessException.unauthorized(ErrorCode.ACCOUNT_DISABLED, '账号已停用');
    }
  }

  private async revalidateArticleAccess(articleId: number): Promise<boolean> {
    const article = await prisma.knowledgeArticle.findUnique({
      where: { id: articleId },
      select: { status: true },
    });
    return article?.status === 'PUBLISHED';
  }

  // ========================
  // Core execution wrapper
  // Encapsulates: availability → rate limit → daily quota → concurrency → execute → release
  // ========================
  private async executeWithLimits<T>(
    userId: number,
    fn: () => Promise<T>
  ): Promise<T> {
    this.ensureAvailable();
    this.checkRateLimit(userId);
    this.checkDailyQuota(userId);
    this.acquireSlot(userId);

    try {
      return await fn();
    } finally {
      this.releaseSlot(userId);
    }
  }

  // ========================
  // Generate draft
  // ========================
  async generateDraft(userId: number, dto: AiDraftRequest) {
    return this.executeWithLimits(userId, async () => {
      const content = await this.provider!.generateDraft(dto.topic, dto.points, dto.requirements);
      return { content };
    });
  }

  // ========================
  // Rewrite text
  // ========================
  async rewriteText(userId: number, dto: AiRewriteRequest) {
    return this.executeWithLimits(userId, async () => {
      const content = await this.provider!.rewriteText(dto.selectedText, dto.mode);
      return { content };
    });
  }

  // ========================
  // Generate summary
  // ========================
  async generateSummary(userId: number, dto: AiSummaryRequest) {
    return this.executeWithLimits(userId, async () => {
      const content = await this.provider!.generateSummary(dto.content);
      return { content };
    });
  }

  // ========================
  // Query knowledge base
  // With post-generation user + article re-validation
  // ========================
  async queryKnowledge(userId: number, question: string) {
    return this.executeWithLimits(userId, async () => {
      // 1. Search PUBLISHED articles only
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

      // 2. Snapshot source article IDs for post-validation
      const sourceIds = articles.map((a) => a.id);

      // 3. Call model
      const references = articles.map((a) => ({
        title: a.title,
        content: a.content,
      }));

      const answer = await this.provider!.answerQuestion(question, references);

      // 4. Post-generation re-validation: user still valid?
      await this.revalidateUser(userId);

      // 5. Post-generation re-validation: sources still PUBLISHED?
      const validSources = await prisma.knowledgeArticle.findMany({
        where: {
          id: { in: sourceIds },
          status: 'PUBLISHED',
        },
        select: { id: true, title: true },
      });

      if (validSources.length === 0) {
        // All sources were withdrawn/taken-down during generation
        throw BusinessException.badRequest(
          ErrorCode.KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED,
          '参考文章已不可用，请重新查询'
        );
      }

      return {
        answer,
        sources: validSources.map((a) => ({
          articleId: a.id,
          title: a.title,
        })),
      };
    });
  }

  // ========================
  // Expose config for testing
  // ========================
  static readonly CONFIG = {
    MAX_PER_MINUTE: AI_MAX_PER_MINUTE,
    MAX_CONCURRENT: AI_MAX_CONCURRENT,
    DAILY_QUOTA: AI_DAILY_QUOTA,
  };
}

// Lazy singleton
let _instance: AiService | null = null;
export function getAiService(): AiService {
  if (!_instance) _instance = new AiService();
  return _instance;
}
