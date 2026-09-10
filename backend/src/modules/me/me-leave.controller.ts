import { Router, Request, Response, NextFunction } from 'express';
import { leaveService } from '../leave/leave.service';
import { myLeaveQuerySchema } from '../leave/dto/leave.dto';
import { sendSuccess, sendPaginated } from '../../common/response/api-response';


import { parseIdParam } from '../../common/utils/parse-id';

export const meLeaveRouter = Router();

// ========================
// My Leave List
// ========================
meLeaveRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = myLeaveQuerySchema.parse(req.query);
    const result = await leaveService.findMyLeaves(req.currentUser!.userId, query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// ========================
// My Leave Detail
// ========================
meLeaveRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const result = await leaveService.findMyLeaveById(id, req.currentUser!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});
