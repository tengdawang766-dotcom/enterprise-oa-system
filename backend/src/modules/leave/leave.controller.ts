import { Router, Request, Response, NextFunction } from 'express';
import { leaveService } from './leave.service';
import {
  createLeaveSchema,
  editLeaveSchema,
  cancelLeaveSchema,
  approveLeaveSchema,
  rejectLeaveSchema,
  resubmitLeaveSchema,
} from './dto/leave.dto';
import { sendSuccess, sendCreated } from '../../common/response/api-response';
import { BusinessException } from '../../common/exception/business-exception';
import { ErrorCode } from '../../common/exception/error-code';

function parseIdParam(idStr: string): number {
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    throw BusinessException.badRequest(ErrorCode.VALIDATION_ERROR, 'ID 必须是正整数');
  }
  return id;
}

export const leaveRouter = Router();

// ========================
// Create + Submit Leave
// ========================
leaveRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = createLeaveSchema.parse(req.body);
    const result = await leaveService.create(req.currentUser!.userId, dto);
    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// Cancel Leave
// ========================
leaveRouter.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const dto = cancelLeaveSchema.parse(req.body);
    const result = await leaveService.cancel(id, req.currentUser!.userId, dto.expectedStateVersion);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// Edit Cancelled Leave
// ========================
leaveRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const dto = editLeaveSchema.parse(req.body);
    const result = await leaveService.edit(id, req.currentUser!.userId, dto);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// Resubmit Cancelled Leave
// ========================
leaveRouter.post('/:id/resubmit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const dto = resubmitLeaveSchema.parse(req.body);
    const result = await leaveService.resubmit(id, req.currentUser!.userId, dto.expectedStateVersion);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// Approve Leave
// ========================
leaveRouter.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const dto = approveLeaveSchema.parse(req.body);
    const result = await leaveService.approve(id, req.currentUser!.userId, dto.comment, dto.expectedStateVersion);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// Reject Leave
// ========================
leaveRouter.post('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const dto = rejectLeaveSchema.parse(req.body);
    const result = await leaveService.reject(id, req.currentUser!.userId, dto.reason, dto.expectedStateVersion);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});
