import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../auth/auth.service';
import { changePasswordSchema } from '../auth/dto/auth.dto';
import { sendSuccess } from '../../common/response/api-response';

export const meRouter = Router();

// Get current user - authentication already verified by app middleware
meRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getCurrentUser(req.currentUser!.userId);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
});

// Change password - authentication already verified by app middleware
meRouter.patch('/password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = changePasswordSchema.parse(req.body);
    const result = await authService.changePassword(
      req.currentUser!.userId,
      dto.currentPassword,
      dto.newPassword
    );

    res.clearCookie('token');
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});
