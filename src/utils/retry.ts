import { delay } from './delay.js';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: any) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<{ result: T; attempts: number }> {
  const { maxAttempts, baseDelayMs, maxDelayMs, shouldRetry = isTransientError } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const delayMs = Math.min(exponentialDelay, maxDelayMs);

      console.log(`    ⚠️  Retry ${attempt}/${maxAttempts} after ${delayMs}ms (${getErrorMessage(error)})`);

      await delay(delayMs);
    }
  }

  throw lastError;
}

export function isTransientError(error: any): boolean {
  const errorString = String(error).toLowerCase();

  const transientPatterns = [
    'timeout',
    'connection closed',
    'socket hang up',
    'econnreset',
    'econnrefused',
    'throttling',
    'throttled',
    'deadlock',
    'server is busy',
    'resource pool',
    'login failed',
  ];

  return transientPatterns.some(pattern => errorString.includes(pattern));
}

function getErrorMessage(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
