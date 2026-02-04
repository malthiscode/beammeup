/**
 * Sanitized logging utility
 * Prevents sensitive information from being logged
 */

const SENSITIVE_KEYS = [
  'password',
  'token',
  'authkey',
  'apikey',
  'secret',
  'authorization',
  'cookie',
  'accesstoken',
  'refreshtoken',
];

export function sanitizeForLogging(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item));
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function sanitizeHeaders(headers: any): any {
  const sanitized: any = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Get safe request info for logging
 */
export function getSafeRequestInfo(request: any) {
  return {
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    // Note: Authorization header is intentionally not included
  };
}

/**
 * Format error for logging (without stack in production)
 */
export function formatErrorForLogging(error: any, isDev = false) {
  const base = {
    message: error?.message,
    code: error?.code,
    statusCode: error?.statusCode,
  };

  if (isDev) {
    return {
      ...base,
      stack: error?.stack,
    };
  }

  return base;
}
