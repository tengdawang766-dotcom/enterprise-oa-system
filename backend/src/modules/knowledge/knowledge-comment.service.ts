import { prisma } from '../../infrastructure/database/prisma';
import { BusinessException } from '../../common/exception/business-exception';
import { ErrorCode } from '../../common/exception/error-code';
import { formatTimestamp } from '../../common/utils/date-format';

export class KnowledgeCommentService {
  // ========================
  // List comments by article (paginated)
  // ========================
  async findByArticle(articleId: number, userId: number, page: number, pageSize: number) {
    // Verify article exists and is PUBLISHED
    const article = await prisma.knowledgeArticle.findUnique({
      where: { id: articleId },
      select: { id: true, status: true },
    });

    if (!article) {
      throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在');
    }

    if (article.status !== 'PUBLISHED') {
      throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在或未发布');
    }

    const skip = (page - 1) * pageSize;

    // Count only non-deleted comments for total
    const total = await prisma.knowledgeComment.count({
      where: { articleId, deletedAt: null },
    });

    const comments = await prisma.knowledgeComment.findMany({
      where: { articleId },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        content: true,
        authorId: true,
        createdAt: true,
        deletedAt: true,
        deletedById: true,
        deleteType: true,
        author: { select: { id: true, name: true } },
      },
    });

    const items = comments.map((c) => ({
      id: c.id,
      content: c.deletedAt ? null : c.content,
      author: { id: c.author.id, name: c.author.name },
      createdAt: formatTimestamp(c.createdAt),
      deletedAt: formatTimestamp(c.deletedAt),
      deleteType: c.deletedAt ? c.deleteType : null,
      isDeleted: !!c.deletedAt,
    }));

    return { items, total, page, pageSize };
  }

  // ========================
  // Create comment
  // ========================
  async create(articleId: number, authorId: number, content: string) {
    const article = await prisma.knowledgeArticle.findUnique({
      where: { id: articleId },
      select: { id: true, status: true },
    });

    if (!article) {
      throw BusinessException.notFound(ErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND, '文章不存在');
    }

    if (article.status !== 'PUBLISHED') {
      throw BusinessException.badRequest(ErrorCode.KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED, '只能对已发布的文章发表评论');
    }

    const comment = await prisma.knowledgeComment.create({
      data: {
        articleId,
        authorId,
        content,
      },
      select: {
        id: true,
        content: true,
        authorId: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    });

    return {
      id: comment.id,
      content: comment.content,
      author: { id: comment.author.id, name: comment.author.name },
      createdAt: formatTimestamp(comment.createdAt),
      deletedAt: null,
      deleteType: null,
      isDeleted: false,
    };
  }

  // ========================
  // Delete own comment (soft delete by author)
  // ========================
  async deleteByAuthor(commentId: number, authorId: number) {
    const comment = await prisma.knowledgeComment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, deletedAt: true },
    });

    if (!comment) {
      throw BusinessException.notFound(ErrorCode.KNOWLEDGE_COMMENT_NOT_FOUND, '评论不存在');
    }

    if (comment.authorId !== authorId) {
      throw BusinessException.forbidden(ErrorCode.KNOWLEDGE_COMMENT_FORBIDDEN, '只能删除自己的评论');
    }

    if (comment.deletedAt) {
      throw BusinessException.conflict(ErrorCode.KNOWLEDGE_COMMENT_ALREADY_DELETED, '评论已被删除');
    }

    await prisma.knowledgeComment.update({
      where: { id: commentId },
      data: {
        deletedAt: new Date(),
        deletedById: authorId,
        deleteType: 'SELF',
      },
    });

    return { success: true };
  }

  // ========================
  // Admin delete comment (soft delete with reason)
  // ========================
  async deleteByAdmin(commentId: number, adminId: number, reason: string) {
    const comment = await prisma.knowledgeComment.findUnique({
      where: { id: commentId },
      select: { id: true, articleId: true, deletedAt: true },
    });

    if (!comment) {
      throw BusinessException.notFound(ErrorCode.KNOWLEDGE_COMMENT_NOT_FOUND, '评论不存在');
    }

    if (comment.deletedAt) {
      throw BusinessException.conflict(ErrorCode.KNOWLEDGE_COMMENT_ALREADY_DELETED, '评论已被删除');
    }

    // Use transaction: soft delete comment + create moderation log
    await prisma.$transaction(async (tx) => {
      await tx.knowledgeComment.update({
        where: { id: commentId },
        data: {
          deletedAt: new Date(),
          deletedById: adminId,
          deleteType: 'ADMIN',
          deleteReason: reason,
        },
      });

      await tx.knowledgeModerationLog.create({
        data: {
          articleId: comment.articleId,
          operatorId: adminId,
          action: 'COMMENT_REMOVED',
          reason,
          articleStatusBefore: 'PUBLISHED',
          articleStatusAfter: 'PUBLISHED',
        },
      });
    });

    return { success: true };
  }
}

export const knowledgeCommentService = new KnowledgeCommentService();
