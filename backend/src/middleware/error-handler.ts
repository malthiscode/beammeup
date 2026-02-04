import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { formatErrorForLogging, sanitizeForLogging } from '../lib/sanitize.js';

interface AppError extends FastifyError {
  statusCode?: number;
  code?: string;
}

export async function errorHandler(
  error: AppError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_SERVER_ERROR';
  const isDev = process.env.NODE_ENV === 'development';

  // Log the error (sanitized)
  if (statusCode >= 500) {
    request.log.error({
      ...formatErrorForLogging(error, isDev),
      requestPath: request.url,
      requestMethod: request.method,
    });
  } else {
    request.log.warn({
      ...formatErrorForLogging(error, isDev),
      requestPath: request.url,
      requestMethod: request.method,
    });
  }

  // Don't expose sensitive error details in production
  const message = isDev ? error.message : 'An error occurred';

  reply.code(statusCode).send({
    error: code,
    message,
    statusCode,
  });
}

