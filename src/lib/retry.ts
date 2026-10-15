import OpenAI from "openai";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isRetryableError(error: unknown): boolean {
  // Network down or timed out → provider/network problem → retry
  if (error instanceof OpenAI.APIConnectionError) return true;

  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) return true; // too many requests
    if (error.status !== undefined && error.status >= 500) return true; // server error
    return false; // 400, 401, 404... → our mistake, don't retry
  }

  return false; // unknown error → probably a bug in our code, don't retry
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const hasAttemptsLeft = attempt < maxAttempts;
      if (!isRetryableError(error) || !hasAttemptsLeft) throw error;

      const ceiling = baseDelayMs * 2 ** (attempt - 1); // 500, 1000, 2000...
      const delay = Math.random() * ceiling; // full jitter
      console.warn(`attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }
  throw new Error("unreachable"); // keeps TypeScript happy; the loop always returns or throws
}

export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> {
  try {
    return await retryWithBackoff(primary);
  } catch (error) {
    if (!isRetryableError(error)) throw error; // our fault → fail loudly, don't hide it
    console.warn("primary exhausted, switching to fallback");
    return await retryWithBackoff(fallback);
  }
}