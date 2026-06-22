export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  label?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, label = 'operation' } = options;
  let lastError: Error = new Error('no attempts made');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1); // exponential backoff
        console.warn(
          `[retry] ${label} failed (attempt ${attempt}/${maxAttempts}): ${lastError.message}. Retrying in ${delayMs}ms`,
        );
        await new Promise<void>(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(`${label} failed after ${maxAttempts} attempts: ${lastError.message}`);
}
