import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { BusinessException } from './business-exception';
import { ErrorCode } from './error-code';
import { logger } from '../logger';

export function globalExceptionHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation error
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: '请求参数不合法',
        fieldErrors: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // Business exception
  if (err instanceof BusinessException) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        fieldErrors: err.fieldErrors,
      },
    });
    return;
  }

  // Unknown error
  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: '服务器内部错误',
    },
  });
}
