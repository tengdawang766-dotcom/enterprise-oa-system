import { Router, Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import {
  createUserSchema,
  updateUserSchema,
  transferDepartmentSchema,
  resetPasswordSchema,
  userQuerySchema,
} from './dto/user.dto';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../common/response/api-response';

export const userRouter = Router();

// Create user
userRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = createUserSchema.parse(req.body);
    const result = await userService.create(dto);
    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
});

// List users
userRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = userQuerySchema.parse(req.query);
    const result = await userService.findAll(query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// User detail
userRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const result = await userService.findById(id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// Update user profile (limited fields only)
userRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const dto = updateUserSchema.parse(req.body);
    const result = await userService.update(id, dto);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// Transfer department
userRouter.put('/:id/department', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const dto = transferDepartmentSchema.parse(req.body);
    const result = await userService.transferDepartment(id, dto);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// Reset password
userRouter.post('/:id/password-reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const dto = resetPasswordSchema.parse(req.body);
    const result = await userService.resetPassword(id, dto);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// Disable user
userRouter.post('/:id/disable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetId = Number(req.params.id);
    const currentUserId = req.currentUser!.userId;
    const result = await userService.disable(currentUserId, targetId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});
