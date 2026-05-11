/**
 * Exhaustive registry of every error code the API emits. Keep alphabetical
 * within each section. The HTTP status the filter will return is mapped in
 * `errorHttpStatus` below.
 */
export const ErrorCodes = {
  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TWO_FA_REQUIRED: 'TWO_FA_REQUIRED',
  TWO_FA_INVALID: 'TWO_FA_INVALID',
  TWO_FA_NOT_SETUP: 'TWO_FA_NOT_SETUP',

  // Attendance
  QR_EXPIRED: 'QR_EXPIRED',
  QR_INVALID: 'QR_INVALID',
  GPS_OUT_OF_RANGE: 'GPS_OUT_OF_RANGE',
  GPS_UNAVAILABLE: 'GPS_UNAVAILABLE',
  GPS_PERMISSION_DENIED: 'GPS_PERMISSION_DENIED',
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  NOT_ENROLLED: 'NOT_ENROLLED',
  SESSION_CLOSED: 'SESSION_CLOSED',
  SESSION_NOT_ACTIVE: 'SESSION_NOT_ACTIVE',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_ALREADY_ACTIVE: 'SESSION_ALREADY_ACTIVE',

  // Schedule
  SCHEDULE_CONFLICT: 'SCHEDULE_CONFLICT',
  SCHEDULE_NOT_PUBLISHED: 'SCHEDULE_NOT_PUBLISHED',
  NO_AVAILABLE_SLOT: 'NO_AVAILABLE_SLOT',

  // Import
  DUPLICATE_IMPORT: 'DUPLICATE_IMPORT',
  INVALID_FILE_FORMAT: 'INVALID_FILE_FORMAT',
  IMPORT_VALIDATION_FAILED: 'IMPORT_VALIDATION_FAILED',

  // General
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Default human-readable message per code. Modules can override with a custom
 * message when throwing AppException.
 */
export const errorMessages: Record<ErrorCode, string> = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_EXPIRED: 'Token has expired',
  TOKEN_INVALID: 'Token is invalid',
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'You do not have permission to perform this action',
  TWO_FA_REQUIRED: 'Two-factor authentication required',
  TWO_FA_INVALID: 'Invalid two-factor code',
  TWO_FA_NOT_SETUP: 'Two-factor authentication is not set up',

  QR_EXPIRED: 'QR code has expired',
  QR_INVALID: 'QR code is invalid',
  GPS_OUT_OF_RANGE: 'You are not within the room range',
  GPS_UNAVAILABLE: 'GPS coordinates are required',
  GPS_PERMISSION_DENIED: 'GPS permission denied',
  ALREADY_REGISTERED: 'Attendance already registered for this session',
  NOT_ENROLLED: 'Student is not enrolled in this section',
  SESSION_CLOSED: 'This attendance session is closed',
  SESSION_NOT_ACTIVE: 'This attendance session is not active',
  SESSION_NOT_FOUND: 'Attendance session not found',
  SESSION_ALREADY_ACTIVE: 'An attendance session is already active for this slot',

  SCHEDULE_CONFLICT: 'Schedule conflict detected',
  SCHEDULE_NOT_PUBLISHED: 'Schedule has not been published yet',
  NO_AVAILABLE_SLOT: 'No available slot could be assigned',

  DUPLICATE_IMPORT: 'Duplicate row in import file',
  INVALID_FILE_FORMAT: 'Invalid file format',
  IMPORT_VALIDATION_FAILED: 'Import validation failed',

  NOT_FOUND: 'Resource not found',
  CONFLICT: 'Resource conflict',
  VALIDATION_ERROR: 'Request validation failed',
  INTERNAL_ERROR: 'Internal server error',
  RATE_LIMITED: 'Too many requests',
};

/** HTTP status to return for each code. */
export const errorHttpStatus: Record<ErrorCode, number> = {
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TWO_FA_REQUIRED: 401,
  TWO_FA_INVALID: 401,
  TWO_FA_NOT_SETUP: 400,

  QR_EXPIRED: 410,
  QR_INVALID: 400,
  GPS_OUT_OF_RANGE: 422,
  GPS_UNAVAILABLE: 400,
  GPS_PERMISSION_DENIED: 403,
  ALREADY_REGISTERED: 409,
  NOT_ENROLLED: 403,
  SESSION_CLOSED: 410,
  SESSION_NOT_ACTIVE: 409,
  SESSION_NOT_FOUND: 404,
  SESSION_ALREADY_ACTIVE: 409,

  SCHEDULE_CONFLICT: 409,
  SCHEDULE_NOT_PUBLISHED: 409,
  NO_AVAILABLE_SLOT: 422,

  DUPLICATE_IMPORT: 409,
  INVALID_FILE_FORMAT: 400,
  IMPORT_VALIDATION_FAILED: 422,

  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
  RATE_LIMITED: 429,
};
