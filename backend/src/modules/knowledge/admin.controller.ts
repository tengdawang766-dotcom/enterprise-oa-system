import { Router, Request, Response, NextFunction } from 'express';
import { knowledgeModerationService } from './knowledge-moderation.service';
import { knowledgeCommentService } from './knowledge-comment.service';
import {
  adminArticleQuerySchema,
  takeDownSchema,
  rejectReviewSchema,
  adminCommentQuerySchema,
} from './dto/moderation.dto';
import { adminDeleteCommentSchema } from './dto/comment.dto';
import { sendSuccess, sendCreated, sendPaginated } from '../../common/response/api-response';
import { parseIdParam } from '../../common/utils/parse-id';

export const adminKnowledgeRouter = Router();

// ========================
// GET /categories — list all categories (including inactive)
// ========================
adminKnowledgeRouter.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await knowledgeModerationService.findAllCategories();
    sendSuccess(res, categories);
  } catch (err) {
    next(err);
  }
});

// ========================
// POST /categories — create category
// ========================
adminKnowledgeRouter.post('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, sortOrder } = req.body;
    const category = await knowledgeModerationService.createCategory(name, description, sortOrder);
    sendCreated(res, category);
  } catch (err) {
    next(err);
  }
});

// ========================
// PUT /categories/:id — update category
// ========================
adminKnowledgeRouter.put('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const { name, description, sortOrder, isActive } = req.body;
    const category = await knowledgeModerationService.updateCategory(id, name, description, sortOrder, isActive);
    sendSuccess(res, category);
  } catch (err) {
    next(err);
  }
});

// ========================
// GET /articles — admin article list
// ========================
adminKnowledgeRouter.get('/articles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = adminArticleQuerySchema.parse(req.query);
    const result = await knowledgeModerationService.findAdminArticles(query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// ========================
// GET /articles/:id — admin article detail
// ========================
adminKnowledgeRouter.get('/articles/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const article = await knowledgeModerationService.findAdminArticleDetail(id);
    sendSuccess(res, article);
  } catch (err) {
    next(err);
  }
});

// ========================
// POST /articles/:id/take-down — take down article
// ========================
adminKnowledgeRouter.post('/articles/:id/take-down', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const dto = takeDownSchema.parse(req.body);
    const result = await knowledgeModerationService.takeDownArticle(id, req.currentUser!.userId, dto.reason);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// POST /articles/:id/review/approve — approve review
// ========================
adminKnowledgeRouter.post('/articles/:id/review/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const result = await knowledgeModerationService.approveReview(id, req.currentUser!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// POST /articles/:id/review/reject — reject review
// ========================
adminKnowledgeRouter.post('/articles/:id/review/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const dto = rejectReviewSchema.parse(req.body);
    const result = await knowledgeModerationService.rejectReview(id, req.currentUser!.userId, dto.reason);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// GET /comments — admin comment list
// ========================
adminKnowledgeRouter.get('/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = adminCommentQuerySchema.parse(req.query);
    const result = await knowledgeModerationService.findAdminComments(query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// ========================
// DELETE /comments/:id — admin delete comment
// ========================
adminKnowledgeRouter.delete('/comments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const dto = adminDeleteCommentSchema.parse(req.body);
    const result = await knowledgeCommentService.deleteByAdmin(id, req.currentUser!.userId, dto.reason);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});
