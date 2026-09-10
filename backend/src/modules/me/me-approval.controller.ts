import { Router, Request, Response, NextFunction } from 'express';
import { leaveService } from '../leave/leave.service';
import { approvalTasksQuerySchema, approvalHistoryQuerySchema } from '../leave/dto/leave.dto';
import { sendSuccess, sendPaginated } from '../../common/response/api-response';


import { parseIdParam } from '../../common/utils/parse-id';

export const meApprovalRouter = Router();

// ========================
// Approval Tasks (pending)
// ========================
meApprovalRouter.get('/approval-tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = approvalTasksQuerySchema.parse(req.query);
    const result = await leaveService.findApprovalTasks(req.currentUser!.userId, query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// ========================
// Approval History
// ========================
meApprovalRouter.get('/approval-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = approvalHistoryQuerySchema.parse(req.query);
    const result = await leaveService.findApprovalHistory(req.currentUser!.userId, query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// ========================
// Approval Detail
// ========================
meApprovalRouter.get('/approvals/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const result = await leaveService.findApprovalDetail(id, req.currentUser!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});
