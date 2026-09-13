import { Router, Request, Response, NextFunction } from 'express';
import { knowledgeService } from './knowledge.service';
import {
  createArticleSchema,
  updateArticleSchema,
  articleListQuerySchema,
  myArticleQuerySchema,
} from './dto/knowledge.dto';
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
