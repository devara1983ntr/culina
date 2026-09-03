/**
 * CULINA — Normalized error model (PRD §20).
 * Every failure surfaced by a provider is an ApiError with a stable type,
 * which makes fallback, retry and user messaging predictable.
 */

export const ErrorType = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  HTTP: 'HTTP_ERROR',
  AUTH: 'AUTH_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  CORS_ERROR: 'CORS_ERROR',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  UNKNOWN: 'UNKNOWN_ERROR',
};

export class ApiError extends Error {
  constructor({ type = ErrorType.UNKNOWN, provider = null, status = null, message = 'Something went wrong', retryable = false, cause = null }) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.provider = provider;
    this.status = status;
    this.retryable = retryable;
    this.cause = cause;
  }
}

/** Did the caller cancel (route change / obsolete search)? Not an error state. */
export function isAbort(err) {
  return Boolean(err) && (err.name === 'AbortError' || err.name === 'TimeoutError') && !(err instanceof ApiError);
}

export function isTimeout(err) {
  return err instanceof ApiError && err.type === ErrorType.TIMEOUT;
}

/** Map any thrown value to an ApiError. */
export function normalizeError(err, providerId) {
  if (err instanceof ApiError) return err;
  if (err?.name === 'TimeoutError') {
    return new ApiError({ type: ErrorType.TIMEOUT, provider: providerId, message: 'The request timed out', retryable: true, cause: err });
  }
  if (err?.name === 'AbortError') {
    return new ApiError({ type: ErrorType.UNKNOWN, provider: providerId, message: 'Request canceled', retryable: false, cause: err });
  }
  if (err instanceof TypeError) {
    // fetch() throws TypeError for network failures AND CORS blocks —
    // browsers don't let us distinguish, so the message covers both.
    return new ApiError({ type: ErrorType.NETWORK, provider: providerId, message: 'Could not reach the provider (network or CORS)', retryable: true, cause: err });
  }
  return new ApiError({ type: ErrorType.UNKNOWN, provider: providerId, message: err?.message || 'Unexpected error', retryable: false, cause: err });
}

/** Human-readable, non-technical messages for the UI. */
export function userMessage(err) {
  if (!err) return 'Something went wrong.';
  if (!(err instanceof ApiError)) return err.message || 'Something went wrong.';
  switch (err.type) {
    case ErrorType.TIMEOUT:
      return 'The request took too long. The provider may be busy — try again.';
    case ErrorType.NETWORK:
      return 'We couldn’t reach this data source. Check your connection or try again.';
    case ErrorType.RATE_LIMIT:
      return 'This data source is rate-limiting requests right now. Please wait a moment and retry.';
    case ErrorType.AUTH:
      return 'This data source requires credentials that are not configured.';
    case ErrorType.INVALID_RESPONSE:
      return 'This data source returned an unexpected response format.';
    case ErrorType.HTTP:
      return err.status === 404 ? 'We couldn’t find that item.' : 'This data source returned an error.';
    case ErrorType.PROVIDER_UNAVAILABLE:
      return 'This data source is currently unavailable.';
    default:
      return 'Something went wrong while loading this data.';
  }
}

/** Response-shape guards used by adapters (PRD §54 — never assume a shape). */
export function assertObject(data, provider, what = 'response') {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ApiError({ type: ErrorType.INVALID_RESPONSE, provider, message: `Malformed ${what}: expected an object`, retryable: false });
  }
  return data;
}

export function assertArray(data, provider, what = 'response') {
  if (!Array.isArray(data)) {
    throw new ApiError({ type: ErrorType.INVALID_RESPONSE, provider, message: `Malformed ${what}: expected an array`, retryable: false });
  }
  return data;
}
