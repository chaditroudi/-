export class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const validationError = (code, message, details = null) => new ApiError(400, code, message, details);
export const unauthorizedError = (message = 'Authentication is required.', details = null) =>
  new ApiError(401, 'AUTH_REQUIRED', message, details);
export const forbiddenError = (message = 'You do not have permission to perform this action.', details = null) =>
  new ApiError(403, 'FORBIDDEN', message, details);
export const notFoundError = (code, message, details = null) => new ApiError(404, code, message, details);
export const conflictError = (code, message, details = null) => new ApiError(409, code, message, details);
export const internalServerError = (message = 'Unexpected server error.', details = null) =>
  new ApiError(500, 'INTERNAL_SERVER_ERROR', message, details);

export const toErrorPayload = (error, requestId) => {
  const apiError = error instanceof ApiError
    ? error
    : internalServerError(error instanceof Error ? error.message : 'Unexpected server error.');

  return {
    status: apiError.status,
    payload: {
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
        requestId,
      },
    },
  };
};

export const sendApiError = (res, error, requestId) => {
  const { status, payload } = toErrorPayload(error, requestId);
  return res.status(status).json(payload);
};
