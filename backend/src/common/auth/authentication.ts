import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../infrastructure/config';
import { BusinessException } from '../exception/business-exception';
import { ErrorCode } from '../exception/error-code';
import { prisma } from '../../infrastructure/database/prisma';

export interface JwtPayload {
  userId: number;
  role: 'ADMIN' | 'EMPLOYEE';
  tokenVersion: number;
}

export interface AuthenticatedUser {
  userId: number;
  role: 'ADMIN' | 'EMPLOYEE';
  tokenVersion: number;
  mustChangePassword: boolean;
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: AuthenticatedUser;
    }
  }
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);
}

export async function authenticationMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.token;
    if (!token) {
      throw BusinessException.unauthorized(ErrorCode.UNAUTHENTICATED, '未登录');
    }

    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

    // Verify account is still enabled and token version matches
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, status: true, tokenVersion: true, role: true, mustChangePassword: true },
    });

    if (!user) {
      throw BusinessException.unauthorized(ErrorCode.UNAUTHENTICATED, '用户不存在');
    }

    if (user.status === 'DISABLED') {
      throw BusinessException.unauthorized(ErrorCode.ACCOUNT_DISABLED, '账号已停用');
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw BusinessException.unauthorized(ErrorCode.AUTH_SESSION_EXPIRED, '登录已过期，请重新登录');
    }

    req.currentUser = {
      userId: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
      mustChangePassword: user.mustChangePassword,
    };

    next();
  } catch (err) {
    if (err instanceof BusinessException) {
      next(err);
    } else if (err instanceof jwt.JsonWebTokenError) {
      next(BusinessException.unauthorized(ErrorCode.UNAUTHENTICATED, '无效的登录凭证'));
    } else {
      next(err);
    }
  }
}

export function requireRole(...roles: Array<'ADMIN' | 'EMPLOYEE'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.currentUser) {
      throw BusinessException.unauthorized(ErrorCode.UNAUTHENTICATED, '未登录');
    }
    if (!roles.includes(req.currentUser.role)) {
      throw BusinessException.forbidden(ErrorCode.FORBIDDEN, '无权访问');
    }
    next();
  };
}

export function forcePasswordChangeMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.currentUser) {
    return next();
  }

  if (!req.currentUser.mustChangePassword) {
    return next();
  }

  // Paths allowed when mustChangePassword is true
  // Use originalUrl which includes the full path
  const allowedPaths = [
    { method: 'GET', path: '/api/v1/me' },
    { method: 'PATCH', path: '/api/v1/me/password' },
    { method: 'DELETE', path: '/api/v1/auth/session' },
  ];

  const isAllowed = allowedPaths.some(
    (route) => req.method === route.method && req.originalUrl === route.path
  );

  if (!isAllowed) {
    throw BusinessException.forbidden(
      ErrorCode.PASSWORD_CHANGE_REQUIRED,
      '首次登录或密码重置后，请先修改密码'
    );
  }

  next();
}
