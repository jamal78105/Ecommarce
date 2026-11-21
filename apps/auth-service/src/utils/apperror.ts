export type AppErrorOptions = {
  status?: string;
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational?: boolean;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = options.status|| 'AppError';
    this.statusCode = options.statusCode || 500;
    this.code = options.code || 'UNKNOWN_ERROR';
    this.isOperational = options.isOperational ?? true;
    Error.captureStackTrace(this , this.constructor)
  }
}