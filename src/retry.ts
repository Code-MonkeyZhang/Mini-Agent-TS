import { RetryConfig } from "./config.js";

export { RetryConfig };

/**
 * Error thrown when a retry loop exhausts all attempts.
 */
export class RetryExhaustedError extends Error {
  attempts: number;
  lastError: unknown;

  constructor(lastError: unknown, attempts: number) {
    super(
      `Retry failed after ${attempts} attempts. Last error: ${String(
        lastError
      )}`
    );
    this.name = "RetryExhaustedError";
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * Calculate exponential-backoff delay.
 *
 * @param attempt 0-based attempt index (0 for the first retry delay)
 * @param config Retry configuration (delays are specified in seconds)
 * @returns Delay in milliseconds (clamped to `config.maxDelay`)
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay =
    config.initialDelay * Math.pow(config.exponentialBase, attempt) * 1000;
  const maxDelayMs = config.maxDelay * 1000;
  return Math.min(delay, maxDelayMs);
}

/**
 * Retry an async function with exponential backoff.
 *
 * @param fn Function to execute (must return a Promise)
 * @param config Retry configuration
 * @param onRetry Optional callback invoked before each retry (1-based attempt number)
 *
 * @remarks
 * The loop runs at most `maxRetries + 1` times:
 * - first execution: attempt 0
 * - retries: attempt 1..maxRetries
 */
export async function asyncRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  onRetry?: ((error: unknown, attempt: number) => void) | null
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === config.maxRetries) {
        throw new RetryExhaustedError(lastError, attempt + 1);
      }

      if (onRetry) {
        onRetry(error, attempt + 1);
      }

      const delay = calculateDelay(attempt, config);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new RetryExhaustedError(lastError, config.maxRetries + 1);
}
