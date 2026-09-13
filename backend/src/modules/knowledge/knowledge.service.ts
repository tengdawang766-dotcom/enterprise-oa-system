import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { BusinessException } from '../../common/exception/business-exception';
import { ErrorCode } from '../../common/exception/error-code';
import { formatTimestamp } from '../../common/utils/date-format';
import {
  CreateArticleRequest,
  UpdateArticleRequest,
  ArticleListQuery,
  MyArticleQuery,
} from './dto/knowledge.dto';

export class KnowledgeService {
  // ========================
  // Category List (active only)
  // ========================
  async findActiveCategories() {
    const categories = await prisma.knowledgeCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
      },
    });

    return categories;
  }

  // ========================
  // Create Article (draft)
  // ========================
  async create(authorId: number, dto: CreateArticleRequest) {
    // Verify category exists and is active
    const category = await prisma.knowledgeCategory.findUnique({
      where: { id: dto.categoryId },
      select: { id: true, isActive: true },
    });

    if (!category || !category.isActive) {
      throw BusinessException.badRequest(
        ErrorCode.KNOWLEDGE_CATEGORY_NOT_AVAILABLE,
        '分类不存在或已停用'
      );
    }

    const article = await prisma.knowledgeArticle.create({
      data: {
        title: dto.title,
        summary: dto.summary || null,
        content: dto.content,
        categoryId: dto.categoryId,
        authorId,
        status: 'DRAFT',
      },
      select: this.articleSelectFields(),
    });

    return this.formatArticle(article);
  }

  // ========================
  // Update Article (author only, DRAFT or PUBLISHED)
  // ========================
  async update(id: number, authorId: number, dto: UpdateArticleRequest) {
    const article = await prisma.knowledgeArticle.findUnique({
      where: { id },
      select: { id: true, authorId: true, status: true },
    });

    if (!article) {
      throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在');
    }

    if (article.authorId !== authorId) {
      throw BusinessException.forbidden(ErrorCode.KNOWLEDGE_ARTICLE_FORBIDDEN, '只能修改自己的文章');
    }

    if (article.status === 'WITHDRAWN') {
      throw BusinessException.conflict(
        ErrorCode.KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED,
        '已撤回的文章不能修改'
      );
    }

    // If categoryId is being updated, verify it's active
    if (dto.categoryId) {
      const category = await prisma.knowledgeCategory.findUnique({
        where: { id: dto.categoryId },
        select: { id: true, isActive: true },
      });

      if (!category || !category.isActive) {
        throw BusinessException.badRequest(
          ErrorCode.KNOWLEDGE_CATEGORY_NOT_AVAILABLE,
          '分类不存在或已停用'
        );
      }
    }

    const data: Prisma.KnowledgeArticleUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.summary !== undefined) data.summary = dto.summary;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.categoryId !== undefined) data.category = { connect: { id: dto.categoryId } };

    const updated = await prisma.knowledgeArticle.update({
      where: { id },
      data,
      select: this.articleSelectFields(),
    });

    return this.formatArticle(updated);
  }

  // ========================
  // Publish (DRAFT -> PUBLISHED, conditional update)
  // ========================
  async publish(id: number, authorId: number) {
    // Use conditional updateMany for atomic state check
    const result = await prisma.knowledgeArticle.updateMany({
      where: { id, authorId, status: 'DRAFT' },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    if (result.count === 0) {
      const existing = await prisma.knowledgeArticle.findUnique({
        where: { id },
        select: { id: true, authorId: true, status: true },
      });

      if (!existing) {
        throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在');
      }

      if (existing.authorId !== authorId) {
        throw BusinessException.forbidden(ErrorCode.KNOWLEDGE_ARTICLE_FORBIDDEN, '只能发布自己的文章');
      }

      if (existing.status === 'PUBLISHED') {
        throw BusinessException.conflict(ErrorCode.KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED, '文章已经发布');
      }

      // WITHDRAWN or other states
      throw BusinessException.conflict(ErrorCode.KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED, '只有草稿状态的文章才能发布');
    }

    const published = await prisma.knowledgeArticle.findUnique({
      where: { id },
      select: this.articleSelectFields(),
    });

    return this.formatArticle(published!);
  }

  // ========================
  // Withdraw (PUBLISHED -> WITHDRAWN, conditional update)
  // ========================
  async withdraw(id: number, authorId: number) {
    const result = await prisma.knowledgeArticle.updateMany({
      where: { id, authorId, status: 'PUBLISHED' },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: new Date(),
      },
    });

    if (result.count === 0) {
      const existing = await prisma.knowledgeArticle.findUnique({
        where: { id },
        select: { id: true, authorId: true, status: true },
      });

      if (!existing) {
        throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在');
      }

      if (existing.authorId !== authorId) {
        throw BusinessException.forbidden(ErrorCode.KNOWLEDGE_ARTICLE_FORBIDDEN, '只能撤回自己的文章');
      }

      if (existing.status === 'WITHDRAWN') {
        throw BusinessException.conflict(ErrorCode.KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED, '文章已经撤回');
      }

      throw BusinessException.conflict(ErrorCode.KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED, '只有已发布的文章才能撤回');
    }

    const withdrawn = await prisma.knowledgeArticle.findUnique({
      where: { id },
      select: this.articleSelectFields(),
    });

    return this.formatArticle(withdrawn!);
  }

  // ========================
  // Public Article List (PUBLISHED only)
  // ========================
  async findPublishedArticles(query: ArticleListQuery) {
    const { page, pageSize, keyword, categoryId } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.KnowledgeArticleWhereInput = {
      status: 'PUBLISHED',
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
        orderBy: { publishedAt: 'desc' },
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

    const items = articles.map((a) => this.formatArticleWithRelations(a));

    return { items, total, page, pageSize };
  }

  // ========================
  // Article Detail (visible to current user)
  // ========================
  async findArticleById(id: number, userId: number) {
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

    // Visibility rules:
    // PUBLISHED: all valid employees
    // DRAFT: author only
    // WITHDRAWN: author only
    if (article.status === 'DRAFT' && article.authorId !== userId) {
      throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在');
    }

    if (article.status === 'WITHDRAWN' && article.authorId !== userId) {
      throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在');
    }

    return this.formatArticleWithRelations(article);
  }

  // ========================
  // My Articles (all statuses for author)
  // ========================
  async findMyArticles(authorId: number, query: MyArticleQuery) {
    const { page, pageSize, keyword, categoryId, status } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.KnowledgeArticleWhereInput = {
      authorId,
    };

    if (keyword) {
      where.title = { contains: keyword };
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (status) {
      where.status = status;
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

    const items = articles.map((a) => this.formatArticleWithRelations(a));

    return { items, total, page, pageSize };
  }

  // ========================
  // Private helpers
  // ========================

  private articleSelectFields() {
    return {
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
    } as const;
  }

  private formatArticle(article: {
    id: number;
    title: string;
    summary: string | null;
    content: string;
    status: string;
    categoryId: number;
    authorId: number;
    publishedAt: Date | null;
    withdrawnAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
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
    };
  }

  private formatArticleWithRelations(article: {
    id: number;
    title: string;
    summary: string | null;
    content?: string;
    status: string;
    categoryId: number;
    authorId: number;
    publishedAt: Date | null;
    withdrawnAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    category: { id: number; name: string };
    author: { id: number; name: string };
  }) {
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
}

export const knowledgeService = new KnowledgeService();
