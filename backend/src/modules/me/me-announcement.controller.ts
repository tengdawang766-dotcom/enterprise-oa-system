import { Router, Request, Response, NextFunction } from 'express';
import { announcementService } from '../announcement/announcement.service';
import { employeeAnnouncementQuerySchema } from '../announcement/dto/announcement.dto';
import { sendSuccess, sendPaginated } from '../../common/response/api-response';
import { BusinessException } from '../../common/exception/business-exception';
import { ErrorCode } from '../../common/exception/error-code';

function parseIdParam(idStr: string): number {
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    throw BusinessException.badRequest(ErrorCode.VALIDATION_ERROR, 'ID 必须是正整数');
  }
  return id;
}

export const meAnnouncementRouter = Router();

// ========================
// Employee: Announcement List (PUBLISHED only)
// ========================
meAnnouncementRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = employeeAnnouncementQuerySchema.parse(req.query);
    const result = await announcementService.findEmployeeAll(req.currentUser!.userId, query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// ========================
// Employee: Open Announcement (record first read)
// ========================
meAnnouncementRouter.post('/:id/open', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const announcementId = parseIdParam(req.params.id);
    const result = await announcementService.openAnnouncement(req.currentUser!.userId, announcementId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});
