import { Router, Request, Response, NextFunction } from 'express';
import { announcementService } from './announcement.service';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  adminAnnouncementQuerySchema,
  employeeAnnouncementQuerySchema,
  readListQuerySchema,
} from './dto/announcement.dto';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../common/response/api-response';


import { parseIdParam } from '../../common/utils/parse-id';

export const announcementRouter = Router();

// ========================
// Admin: Create Draft
// ========================
announcementRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = createAnnouncementSchema.parse(req.body);
    const result = await announcementService.create(req.currentUser!.userId, dto);
    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// Admin: Announcement List
// ========================
announcementRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = adminAnnouncementQuerySchema.parse(req.query);
    const result = await announcementService.findAdminAll(query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// ========================
// Admin: Announcement Detail
// ========================
announcementRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const result = await announcementService.findAdminById(id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// Admin: Update Draft
// ========================
announcementRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const dto = updateAnnouncementSchema.parse(req.body);
    const result = await announcementService.update(id, dto);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// Admin: Delete Draft
// ========================
announcementRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    await announcementService.remove(id);
    sendNoContent(res);
  } catch (err) {
    next(err);
  }
});

// ========================
// Admin: Publish
// ========================
announcementRouter.post('/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const result = await announcementService.publish(id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// Admin: Withdraw
// ========================
announcementRouter.post('/:id/withdraw', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const result = await announcementService.withdraw(id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// Admin: Read Stats
// ========================
announcementRouter.get('/:id/read-stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const result = await announcementService.getReadStats(id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// Admin: Read List
// ========================
announcementRouter.get('/:id/read-list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const query = readListQuerySchema.parse(req.query);
    const result = await announcementService.getReadList(id, query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// ========================
// Admin: Unread List
// ========================
announcementRouter.get('/:id/unread-list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const query = readListQuerySchema.parse(req.query);
    const result = await announcementService.getUnreadList(id, query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});
