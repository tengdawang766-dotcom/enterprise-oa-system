export class BusinessException extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly fieldErrors?: Array<{ field: string; message: string }>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    fieldErrors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.name = 'BusinessException';
  }

  static badRequest(code: string, message: string, fieldErrors?: Array<{ field: string; message: string }>) {
    return new BusinessException(400, code, message, fieldErrors);
  }

  static unauthorized(code: string, message: string) {
    return new BusinessException(401, code, message);
  }

  static forbidden(code: string, message: string) {
    return new BusinessException(403, code, message);
  }

  static notFound(code: string, message: string) {
    return new BusinessException(404, code, message);
  }

  static conflict(code: string, message: string) {
    return new BusinessException(409, code, message);
  }

  static internal(code: string, message: string) {
    return new BusinessException(500, code, message);
  }
}
