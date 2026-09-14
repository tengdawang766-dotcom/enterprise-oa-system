import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { BusinessException } from '../../common/exception/business-exception';
import { ErrorCode } from '../../common/exception/error-code';
import { formatTimestamp } from '../../common/utils/date-format';
import {
  AdminArticleQuery,
  AdminCommentQuery,
} from './dto/moderation.dto';

export class KnowledgeModerationService {
  // ========================
  // Admin: list articles (PUBLISHED, TAKEN_DOWN, PENDING_REVIEW)
  // ========================
  async findAdminArticles(query: AdminArticleQuery) {
    const { page, pageSize, keyword, categoryId, status } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.KnowledgeArticleWhereInput = {
      status: status ? { in: status } : { in: ['PUBLISHED', 'TAKEN_DOWN', 'PENDING_REVIEW'] },
    };

    if (keyword) {
      where.title = { contains: keyword };
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [articles, total] = await Promise.all([
      prisma.knowledgeArticle.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          summary: true,
          status: true,
          categoryId: true,
          authorId: true,
          publishedAt: true,
          withdrawnAt: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
          author: { select: { id: true, name: true } },
        },
      }),
      prisma.knowledgeArticle.count({ where }),
    ]);

    const items = articles.map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
      status: a.status,
      categoryId: a.categoryId,
      authorId: a.authorId,
      publishedAt: formatTimestamp(a.publishedAt),
      withdrawnAt: formatTimestamp(a.withdrawnAt),
      createdAt: formatTimestamp(a.createdAt),
      updatedAt: formatTimestamp(a.updatedAt),
      category: { id: a.category.id, name: a.category.name },
      author: { id: a.author.id, name: a.author.name },
    }));

    return { items, total, page, pageSize };
  }

  // ========================
  // Admin: article detail
  // ========================
  async findAdminArticleDetail(id: number) {
    const article = await prisma.knowledgeArticle.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        summary: true,
        content: true,
        status: true,
        categoryId: true,
        authorId: true,
        publishedAt: true,
        withdrawnAt: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
      },
    });

    if (!article) {
      throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在');
    }

    const allowedStatuses = ['PUBLISHED', 'TAKEN_DOWN', 'PENDING_REVIEW'];
    if (!allowedStatuses.includes(article.status)) {
      throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在');
    }

    return {
      id: article.id,
      title: article.title,
      summary: article.summary,
      content: article.content,
      status: article.status,
      categoryId: article.categoryId,
      authorId: article.authorId,
      publishedAt: formatTimestamp(article.publishedAt),
      withdrawnAt: formatTimestamp(article.withdrawnAt),
      createdAt: formatTimestamp(article.createdAt),
      updatedAt: formatTimestamp(article.updatedAt),
      category: { id: article.category.id, name: article.category.name },
      author: { id: article.author.id, name: article.author.name },
    };
  }

  // ========================
  // Take down article (PUBLISHED → TAKEN_DOWN)
  // ========================
  async takeDownArticle(articleId: number, adminId: number, reason: string) {
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.knowledgeArticle.updateMany({
        where: { id: articleId, status: 'PUBLISHED' },
        data: { status: 'TAKEN_DOWN' },
      });

      if (updateResult.count === 0) {
        const existing = await tx.knowledgeArticle.findUnique({
          where: { id: articleId },
          select: { id: true, status: true },
        });

        if (!existing) {
          throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在');
        }

        throw BusinessException.conflict(
          ErrorCode.KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED,
          `文章当前状态为 ${existing.status}，无法执行下架操作`
        );
      }

      await tx.knowledgeModerationLog.create({
        data: {
          articleId,
          operatorId: adminId,
          action: 'TAKE_DOWN',
          reason,
          articleStatusBefore: 'PUBLISHED',
          articleStatusAfter: 'TAKEN_DOWN',
        },
      });

      return tx.knowledgeArticle.findUnique({
        where: { id: articleId },
        select: {
          id: true,
          title: true,
          status: true,
          author: { select: { id: true, name: true } },
        },
      });
    });

    return result;
  }

  // ========================
  // Submit review (TAKEN_DOWN → PENDING_REVIEW, author only)
  // ========================
  async submitReview(articleId: number, authorId: number) {
    const article = await prisma.knowledgeArticle.findUnique({
      where: { id: articleId },
      select: { id: true, authorId: true, status: true },
    });

    if (!article) {
      throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在');
    }

    if (article.authorId !== authorId) {
      throw BusinessException.forbidden(ErrorCode.KNOWLEDGE_ARTICLE_FORBIDDEN, '只能提交自己的文章');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.knowledgeArticle.updateMany({
        where: { id: articleId, authorId, status: 'TAKEN_DOWN' },
        data: { status: 'PENDING_REVIEW' },
      });

      if (updateResult.count === 0) {
        throw BusinessException.conflict(
          ErrorCode.KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED,
          '只有已下架的文章才能提交复审'
        );
      }

      await tx.knowledgeModerationLog.create({
        data: {
          articleId,
          operatorId: authorId,
          action: 'REVIEW_SUBMITTED',
          reason: '作者提交复审',
          articleStatusBefore: 'TAKEN_DOWN',
          articleStatusAfter: 'PENDING_REVIEW',
        },
      });

      return tx.knowledgeArticle.findUnique({
        where: { id: articleId },
        select: {
          id: true,
          title: true,
          status: true,
          author: { select: { id: true, name: true } },
        },
      });
    });

    return result;
  }

  // ========================
  // Approve review (PENDING_REVIEW → PUBLISHED)
  // ========================
  async approveReview(articleId: number, adminId: number) {
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.knowledgeArticle.updateMany({
        where: { id: articleId, status: 'PENDING_REVIEW' },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });

      if (updateResult.count === 0) {
        const existing = await tx.knowledgeArticle.findUnique({
          where: { id: articleId },
          select: { id: true, status: true },
        });

        if (!existing) {
          throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在');
        }

        throw BusinessException.conflict(
          ErrorCode.KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED,
          '文章不在待审核状态'
        );
      }

      await tx.knowledgeModerationLog.create({
        data: {
          articleId,
          operatorId: adminId,
          action: 'RESTORE_APPROVED',
          reason: '管理员审核通过',
          articleStatusBefore: 'PENDING_REVIEW',
          articleStatusAfter: 'PUBLISHED',
        },
      });

      return tx.knowledgeArticle.findUnique({
        where: { id: articleId },
        select: {
          id: true,
          title: true,
          status: true,
          author: { select: { id: true, name: true } },
        },
      });
    });

    return result;
  }

  // ========================
  // Reject review (PENDING_REVIEW → TAKEN_DOWN)
  // ========================
  async rejectReview(articleId: number, adminId: number, reason: string) {
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.knowledgeArticle.updateMany({
        where: { id: articleId, status: 'PENDING_REVIEW' },
        data: { status: 'TAKEN_DOWN' },
      });

      if (updateResult.count === 0) {
        const existing = await tx.knowledgeArticle.findUnique({
          where: { id: articleId },
          select: { id: true, status: true },
        });

        if (!existing) {
          throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在');
        }

        throw BusinessException.conflict(
          ErrorCode.KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED,
          '文章不在待审核状态'
        );
      }

      await tx.knowledgeModerationLog.create({
        data: {
          articleId,
          operatorId: adminId,
          action: 'RESTORE_REJECTED',
          reason,
          articleStatusBefore: 'PENDING_REVIEW',
          articleStatusAfter: 'TAKEN_DOWN',
        },
      });

      return tx.knowledgeArticle.findUnique({
        where: { id: articleId },
        select: {
          id: true,
          title: true,
          status: true,
          author: { select: { id: true, name: true } },
        },
      });
    });

    return result;
  }

  // ========================
  // Category CRUD
  // ========================
  async findAllCategories() {
    const categories = await prisma.knowledgeCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return categories.map((c) => ({
      ...c,
      createdAt: formatTimestamp(c.createdAt),
      updatedAt: formatTimestamp(c.updatedAt),
    }));
  }

  async createCategory(name: string, description: string | undefined, sortOrder: number | undefined) {
    // Check name unique
    const existing = await prisma.knowledgeCategory.findFirst({
      where: { name },
      select: { id: true },
    });

    if (existing) {
      throw BusinessException.conflict(ErrorCode.KNOWLEDGE_CATEGORY_NAME_EXISTS, '分类名称已存在');
    }

    const category = await prisma.knowledgeCategory.create({
      data: {
        name,
        description: description || null,
        sortOrder: sortOrder ?? 0,
      },
      select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...category,
      createdAt: formatTimestamp(category.createdAt),
      updatedAt: formatTimestamp(category.updatedAt),
    };
  }

  async updateCategory(
    id: number,
    name: string | undefined,
    description: string | undefined,
    sortOrder: number | undefined,
    isActive: boolean | undefined
  ) {
    const category = await prisma.knowledgeCategory.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!category) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '分类不存在');
    }

    // Check name unique if changing
    if (name && name !== category.name) {
      const existing = await prisma.knowledgeCategory.findFirst({
        where: { name, id: { not: id } },
        select: { id: true },
      });

      if (existing) {
        throw BusinessException.conflict(ErrorCode.KNOWLEDGE_CATEGORY_NAME_EXISTS, '分类名称已存在');
      }
    }

    const data: Prisma.KnowledgeCategoryUpdateInput = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.knowledgeCategory.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...updated,
      createdAt: formatTimestamp(updated.createdAt),
      updatedAt: formatTimestamp(updated.updatedAt),
    };
  }

  // ========================
  // Admin: list comments by article title search
  // ========================
  async findAdminComments(query: AdminCommentQuery) {
    const { page, pageSize, keyword } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.KnowledgeCommentWhereInput = {};

    if (keyword) {
      where.article = { title: { contains: keyword } };
    }

    const [comments, total] = await Promise.all([
      prisma.knowledgeComment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          articleId: true,
          authorId: true,
          createdAt: true,
          deletedAt: true,
          deletedById: true,
          deleteType: true,
          deleteReason: true,
          article: { select: { id: true, title: true } },
          author: { select: { id: true, name: true } },
        },
      }),
      prisma.knowledgeComment.count({ where }),
    ]);

    const items = comments.map((c) => ({
      id: c.id,
      content: c.deletedAt ? null : c.content,
      article: { id: c.article.id, title: c.article.title },
      author: { id: c.author.id, name: c.author.name },
      createdAt: formatTimestamp(c.createdAt),
      deletedAt: formatTimestamp(c.deletedAt),
      deleteType: c.deletedAt ? c.deleteType : null,
      deleteReason: c.deleteReason,
      isDeleted: !!c.deletedAt,
    }));

    return { items, total, page, pageSize };
  }
}

export const knowledgeModerationService = new KnowledgeModerationService();
