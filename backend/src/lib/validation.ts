/**
 * Input validation schemas for all API endpoints
 * Validates request payloads to prevent injection and ensure data integrity
 */

export interface ValidationError {
  field: string;
  message: string;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

export function validateUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_\-]{3,32}$/;
  return usernameRegex.test(username);
}

export function validatePassword(password: string): boolean {
  return password.length >= 8 && password.length <= 256;
}

export function validateRole(role: string): boolean {
  return ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER'].includes(role);
}

export function validatePort(port: any): boolean {
  const portNum = parseInt(port, 10);
  return portNum >= 1024 && portNum <= 65535 && !isNaN(portNum);
}

export function validateBoolean(value: any): boolean {
  return typeof value === 'boolean';
}

export function validateString(value: any, minLength = 0, maxLength = 1024): boolean {
  return typeof value === 'string' && value.length >= minLength && value.length <= maxLength;
}

export function validateObject(value: any): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Login request validation
 */
export function validateLoginRequest(payload: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!validateString(payload?.username, 1, 32)) {
    errors.push({ field: 'username', message: 'Invalid username' });
  }

  if (!validateString(payload?.password, 1, 256)) {
    errors.push({ field: 'password', message: 'Invalid password' });
  }

  return errors;
}

/**
 * Create user request validation
 */
export function validateCreateUserRequest(payload: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!validateUsername(payload?.username)) {
    errors.push({ field: 'username', message: 'Username must be 3-32 chars, alphanumeric + _ -' });
  }

  if (!validatePassword(payload?.password)) {
    errors.push({ field: 'password', message: 'Password must be 8-256 characters' });
  }

  if (!validateRole(payload?.role)) {
    errors.push({ field: 'role', message: 'Invalid role' });
  }

  if (payload?.email && !validateEmail(payload.email)) {
    errors.push({ field: 'email', message: 'Invalid email address' });
  }

  return errors;
}

/**
 * Update user request validation
 */
export function validateUpdateUserRequest(payload: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (payload?.role !== undefined && !validateRole(payload.role)) {
    errors.push({ field: 'role', message: 'Invalid role' });
  }

  if (payload?.isActive !== undefined && !validateBoolean(payload.isActive)) {
    errors.push({ field: 'isActive', message: 'isActive must be boolean' });
  }

  if (payload?.password !== undefined && !validatePassword(payload.password)) {
    errors.push({ field: 'password', message: 'Password must be 8-256 characters' });
  }

  return errors;
}

/**
 * Config update validation
 */
export function validateConfigUpdate(payload: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!validateObject(payload)) {
    errors.push({ field: 'body', message: 'Payload must be an object' });
    return errors;
  }

  if (payload.Port !== undefined && !validatePort(payload.Port)) {
    errors.push({ field: 'Port', message: 'Port must be 1024-65535' });
  }

  if (payload.UpdateReminderTime !== undefined) {
    const timeRegex = /^[0-9]*\.?[0-9]+(s|min|h|d)$/;
    if (!validateString(payload.UpdateReminderTime) || !timeRegex.test(payload.UpdateReminderTime)) {
      errors.push({ field: 'UpdateReminderTime', message: 'Invalid time format (e.g., "30min", "2h")' });
    }
  }

  if (payload.Tags !== undefined && !validateString(payload.Tags, 0, 1024)) {
    errors.push({ field: 'Tags', message: 'Tags too long (max 1024 chars)' });
  }

  if (payload.Map !== undefined && !validateString(payload.Map, 0, 256)) {
    errors.push({ field: 'Map', message: 'Map name too long (max 256 chars)' });
  }

  if (payload.LogChat !== undefined && !validateBoolean(payload.LogChat)) {
    errors.push({ field: 'LogChat', message: 'LogChat must be boolean' });
  }

  return errors;
}

/**
 * AuthKey replacement validation
 */
export function validateAuthKeyReplace(payload: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!validateString(payload?.password, 1, 256)) {
    errors.push({ field: 'password', message: 'Password required' });
  }

  if (!validateString(payload?.newAuthKey, 1, 512)) {
    errors.push({ field: 'newAuthKey', message: 'Invalid AuthKey' });
  }

  return errors;
}

/**
 * Create Owner request validation (first-run)
 */
export function validateCreateOwnerRequest(payload: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!validateUsername(payload?.username)) {
    errors.push({ field: 'username', message: 'Username must be 3-32 chars, alphanumeric + _ -' });
  }

  if (!validatePassword(payload?.password)) {
    errors.push({ field: 'password', message: 'Password must be 8-256 characters' });
  }

  if (payload?.password !== payload?.confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Passwords do not match' });
  }

  if (payload?.email && !validateEmail(payload.email)) {
    errors.push({ field: 'email', message: 'Invalid email address' });
  }

  return errors;
}

/**
 * Pagination query validation
 */
export function validatePaginationQuery(payload: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (payload?.skip !== undefined) {
    const skip = parseInt(payload.skip, 10);
    if (isNaN(skip) || skip < 0 || skip > 1000000) {
      errors.push({ field: 'skip', message: 'Invalid skip parameter' });
    }
  }

  if (payload?.take !== undefined) {
    const take = parseInt(payload.take, 10);
    if (isNaN(take) || take < 1 || take > 1000) {
      errors.push({ field: 'take', message: 'Invalid take parameter (1-1000)' });
    }
  }

  return errors;
}
