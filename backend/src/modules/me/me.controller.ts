import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../auth/auth.service';
import { changePasswordSchema } from '../auth/dto/auth.dto';
import { sendSuccess } from '../../common/response/api-response';
import { updateContactStrictSchema } from './dto/me.dto';
import { meService } from './me.service';

export const meRouter = Router();

// Get current user profile
meRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await meService.getProfile(req.currentUser!.userId);
    sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
});

// Get work dashboard overview
meRouter.get('/work-overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboard = await meService.getDashboard(req.currentUser!.userId);
    sendSuccess(res, dashboard);
  } catch (err) {
    next(err);
  }
});

// Update current user's contact info (workEmail, phone)
meRouter.patch('/contact', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = updateContactStrictSchema.parse(req.body);
    const profile = await meService.updateContact(req.currentUser!.userId, dto);
    sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
});

// Change password
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
