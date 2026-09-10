import { BusinessException } from '../exception/business-exception';
import { ErrorCode } from '../exception/error-code';

/**
 * Parse a route parameter as a positive integer ID.
 * Throws 400 BAD_REQUEST if the value is not a valid positive integer.
 */
export function parseIdParam(idStr: string): number {
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    throw BusinessException.badRequest(ErrorCode.VALIDATION_ERROR, 'ID 必须是正整数');
  }
  return id;
}
