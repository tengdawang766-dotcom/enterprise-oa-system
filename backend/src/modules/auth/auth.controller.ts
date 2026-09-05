import { Router, Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { loginSchema } from './dto/auth.dto';
import { sendSuccess, sendNoContent } from '../../common/response/api-response';
import { authenticationMiddleware } from '../../common/auth/authentication';
import { config } from '../../infrastructure/config';

export const authRouter = Router();

// Login
authRouter.post('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = loginSchema.parse(req.body);
    const result = await authService.login(dto);

    res.cookie('token', result.token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    sendSuccess(res, {
      user: result.user,
      mustChangePassword: result.user.mustChangePassword,
    });
  } catch (err) {
    next(err);
  }
});

// Logout - no auth required, always clear cookie
authRouter.delete('/session', async (req: Request, res: Response, _next: NextFunction) => {
  res.clearCookie('token');
  sendNoContent(res);
});
