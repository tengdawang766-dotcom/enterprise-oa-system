import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { BusinessException } from '../../common/exception/business-exception';
import { ErrorCode } from '../../common/exception/error-code';
import { formatTimestamp } from '../../common/utils/date-format';

export class KnowledgeReactionService {
  // ========================
  // Like article
  // ========================
  async likeArticle(articleId: number, userId: number) {
    const article = await prisma.knowledgeArticle.findUnique({
      where: { id: articleId },
      select: { id: true, status: true },
    });

    if (!article || article.status !== 'PUBLISHED') {
      throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在或未发布');
    }

    // Upsert pattern: try create, catch duplicate
    try {
      await prisma.knowledgeArticleLike.create({
        data: { articleId, userId },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Already liked — treat as success
      } else {
        throw err;
      }
    }

    const likeCount = await prisma.knowledgeArticleLike.count({
      where: { articleId },
    });

    return { liked: true, likeCount };
  }

  // ========================
  // Unlike article
  // ========================
  async unlikeArticle(articleId: number, userId: number) {
    await prisma.knowledgeArticleLike.deleteMany({
      where: { articleId, userId },
    });

    const likeCount = await prisma.knowledgeArticleLike.count({
      where: { articleId },
    });

    return { liked: false, likeCount };
  }

  // ========================
  // Favorite article
  // ========================
  async favoriteArticle(articleId: number, userId: number) {
    const article = await prisma.knowledgeArticle.findUnique({
      where: { id: articleId },
      select: { id: true, status: true },
    });

    if (!article || article.status !== 'PUBLISHED') {
      throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在或未发布');
    }

    try {
      await prisma.knowledgeArticleFavorite.create({
        data: { articleId, userId },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Already favorited — treat as success
      } else {
        throw err;
      }
    }

    return { favorited: true };
  }

  // ========================
  // Unfavorite article
  // ========================
  async unfavoriteArticle(articleId: number, userId: number) {
    await prisma.knowledgeArticleFavorite.deleteMany({
      where: { articleId, userId },
    });

    return { favorited: false };
  }

  // ========================
  // My favorites (paginated)
  // ========================
  async getMyFavorites(userId: number, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const total = await prisma.knowledgeArticleFavorite.count({
      where: { userId },
    });

    const favorites = await prisma.knowledgeArticleFavorite.findMany({
      where: { userId },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        article: {
          select: {
            id: true,
            title: true,
            summary: true,
            status: true,
            author: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    const items = favorites.map((f) => {
      if (f.article.status === 'PUBLISHED') {
        return {
          available: true,
          favoriteId: f.id,
          favoritedAt: formatTimestamp(f.createdAt),
          article: {
            id: f.article.id,
            title: f.article.title,
            summary: f.article.summary,
            author: f.article.author,
            category: f.article.category,
          },
        };
      }

      return {
        available: false,
        favoriteId: f.id,
        articleId: f.article.id,
        favoritedAt: formatTimestamp(f.createdAt),
        reason: '文章已不可用',
      };
    });

    return { items, total, page, pageSize };
  }

  // ========================
  // Get article interaction info
  // ========================
  async getArticleInteraction(articleId: number, userId: number) {
    const [likeCount, commentCount, likedByMe, favoritedByMe] = await Promise.all([
      prisma.knowledgeArticleLike.count({ where: { articleId } }),
      prisma.knowledgeComment.count({ where: { articleId, deletedAt: null } }),
      prisma.knowledgeArticleLike.findFirst({ where: { articleId, userId }, select: { id: true } }),
      prisma.knowledgeArticleFavorite.findFirst({ where: { articleId, userId }, select: { id: true } }),
    ]);

    return {
      likeCount,
      commentCount,
      likedByMe: !!likedByMe,
      favoritedByMe: !!favoritedByMe,
    };
  }
}

export const knowledgeReactionService = new KnowledgeReactionService();
