import { Router, Request, Response, NextFunction } from 'express';
import { knowledgeService } from './knowledge.service';
import { knowledgeCommentService } from './knowledge-comment.service';
import { knowledgeReactionService } from './knowledge-reaction.service';
import { knowledgeModerationService } from './knowledge-moderation.service';
import { getAiService } from './ai/ai.service';
import {
  createArticleSchema,
  updateArticleSchema,
  articleListQuerySchema,
  myArticleQuerySchema,
} from './dto/knowledge.dto';
import { commentQuerySchema, createCommentSchema } from './dto/comment.dto';
import { aiDraftSchema, aiRewriteSchema, aiSummarySchema, aiQuerySchema } from './dto/ai.dto';
import { sendSuccess, sendCreated, sendPaginated } from '../../common/response/api-response';
import { parseIdParam } from '../../common/utils/parse-id';

export const knowledgeRouter = Router();

// ========================
// GET /categories — active categories
// ========================
knowledgeRouter.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await knowledgeService.findActiveCategories();
    sendSuccess(res, categories);
  } catch (err) {
    next(err);
  }
});

// ========================
// GET /articles — published article list (public)
// ========================
knowledgeRouter.get('/articles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = articleListQuerySchema.parse(req.query);
    const result = await knowledgeService.findPublishedArticles(query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// ========================
// GET /articles/:id — article detail (visible to user)
// ========================
knowledgeRouter.get('/articles/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const result = await knowledgeService.findArticleById(id, req.currentUser!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// POST /articles — create draft
// ========================
knowledgeRouter.post('/articles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = createArticleSchema.parse(req.body);
    const result = await knowledgeService.create(req.currentUser!.userId, dto);
    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// PATCH /articles/:id — update article
// ========================
knowledgeRouter.patch('/articles/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const dto = updateArticleSchema.parse(req.body);
    const result = await knowledgeService.update(id, req.currentUser!.userId, dto);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// POST /articles/:id/publish — publish draft
// ========================
knowledgeRouter.post('/articles/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const result = await knowledgeService.publish(id, req.currentUser!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// POST /articles/:id/withdraw — withdraw published
// ========================
knowledgeRouter.post('/articles/:id/withdraw', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const result = await knowledgeService.withdraw(id, req.currentUser!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// GET /me/articles — my articles (all statuses)
// ========================
knowledgeRouter.get('/me/articles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = myArticleQuerySchema.parse(req.query);
    const result = await knowledgeService.findMyArticles(req.currentUser!.userId, query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// ========================
// GET /articles/:id/comments — list comments
// ========================
knowledgeRouter.get('/articles/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const articleId = parseIdParam(req.params.id);
    const query = commentQuerySchema.parse(req.query);
    const result = await knowledgeCommentService.findByArticle(
      articleId,
      req.currentUser!.userId,
      query.page,
      query.pageSize
    );
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// ========================
// POST /articles/:id/comments — create comment
// ========================
knowledgeRouter.post('/articles/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const articleId = parseIdParam(req.params.id);
    const dto = createCommentSchema.parse(req.body);
    const result = await knowledgeCommentService.create(articleId, req.currentUser!.userId, dto.content);
    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// DELETE /comments/:id — delete own comment
// ========================
knowledgeRouter.delete('/comments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const commentId = parseIdParam(req.params.id);
    const result = await knowledgeCommentService.deleteByAuthor(commentId, req.currentUser!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// PUT /articles/:id/like — like article
// ========================
knowledgeRouter.put('/articles/:id/like', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const articleId = parseIdParam(req.params.id);
    const result = await knowledgeReactionService.likeArticle(articleId, req.currentUser!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// DELETE /articles/:id/like — unlike article
// ========================
knowledgeRouter.delete('/articles/:id/like', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const articleId = parseIdParam(req.params.id);
    const result = await knowledgeReactionService.unlikeArticle(articleId, req.currentUser!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// PUT /articles/:id/favorite — favorite article
// ========================
knowledgeRouter.put('/articles/:id/favorite', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const articleId = parseIdParam(req.params.id);
    const result = await knowledgeReactionService.favoriteArticle(articleId, req.currentUser!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// DELETE /articles/:id/favorite — unfavorite article
// ========================
knowledgeRouter.delete('/articles/:id/favorite', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const articleId = parseIdParam(req.params.id);
    const result = await knowledgeReactionService.unfavoriteArticle(articleId, req.currentUser!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// GET /me/favorites — my favorites
// ========================
knowledgeRouter.get('/me/favorites', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = commentQuerySchema.parse(req.query);
    const result = await knowledgeReactionService.getMyFavorites(
      req.currentUser!.userId,
      query.page,
      query.pageSize
    );
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// ========================
// POST /articles/:id/submit-review — submit review (TAKEN_DOWN → PENDING_REVIEW)
// ========================
knowledgeRouter.post('/articles/:id/submit-review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const result = await knowledgeModerationService.submitReview(id, req.currentUser!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// POST /ai/draft — AI draft generation
// ========================
knowledgeRouter.post('/ai/draft', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = aiDraftSchema.parse(req.body);
    const result = await getAiService().generateDraft(req.currentUser!.userId, dto);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// POST /ai/rewrite — AI text rewrite
// ========================
knowledgeRouter.post('/ai/rewrite', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = aiRewriteSchema.parse(req.body);
    const result = await getAiService().rewriteText(req.currentUser!.userId, dto);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// POST /ai/summary — AI summary generation
// ========================
knowledgeRouter.post('/ai/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = aiSummarySchema.parse(req.body);
    const result = await getAiService().generateSummary(req.currentUser!.userId, dto);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// POST /ai/query — AI knowledge query
// ========================
knowledgeRouter.post('/ai/query', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = aiQuerySchema.parse(req.body);
    const result = await getAiService().queryKnowledge(req.currentUser!.userId, dto.question);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});
