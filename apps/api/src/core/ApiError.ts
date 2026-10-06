import { ERROR_CODES, type ErrorCode } from '@expense/shared';

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  statusCode: number;
  code: ErrorCode;
  errors?: FieldError[];

  constructor(statusCode: number, message: string, code: ErrorCode, errors?: FieldError[]) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
  }

  static badRequest(message: string, errors?: FieldError[], code: ErrorCode = ERROR_CODES.VALIDATION) {
    return new ApiError(400, message, code, errors);
  }

  static unauthorized(message = 'Unauthorized', code: ErrorCode = ERROR_CODES.UNAUTHORIZED) {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'You do not have permission to do that', code: ErrorCode = ERROR_CODES.FORBIDDEN) {
    return new ApiError(403, message, code);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, message, ERROR_CODES.NOT_FOUND);
  }

  static conflict(message: string, code: ErrorCode = ERROR_CODES.CONFLICT) {
    return new ApiError(409, message, code);
  }

  static tooMany(message = 'Too many requests, try again later') {
    return new ApiError(429, message, ERROR_CODES.RATE_LIMITED);
  }
}
