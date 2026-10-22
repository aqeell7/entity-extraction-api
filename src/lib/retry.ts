import OpenAI from "openai";

// ============================================================================
// SLEEP HELPER: Converts old-school setTimeout into a modern async/await Promise
// ============================================================================
// setTimeout normally uses callbacks. By wrapping it in a new Promise, we can 
// write `await sleep(1000)` to cleanly pause our code for a set number of milliseconds.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// ERROR FILTER: Decides if an error is worth retrying or if we should fail fast
// ============================================================================
export function isRetryableError(error: unknown): boolean {
  
  // 1. NETWORK LEVEL: If the internet dropped or the connection timed out, 
  // it's an infrastructure problem outside our control -> YES, retry.
  if (error instanceof OpenAI.APIConnectionError) return true;

  // 2. API LEVEL: If OpenAI returned a status code, let's check which one:
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) return true; // 429 = Rate limit exceeded (too many requests) -> retry
    if (error.status !== undefined && error.status >= 500) return true; // 500+ = OpenAI's servers crashed -> retry
    
    return false; // 400, 401, 404... = Client errors (bad API key, typo in model name, bad request) -> OUR MISTAKE, do NOT retry.
  }

  // 3. UNKNOWN: Any other random error is likely a bug in our code -> do NOT retry.
  return false; 
}

// ============================================================================
// RETRY ENGINE: Tries a function multiple times with increasing delays (backoff)
// ============================================================================
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,       // The async action we want to run (like calling OpenAI)
  maxAttempts = 3,            // Maximum number of tries before giving up
  baseDelayMs = 500           // Starting delay in milliseconds
): Promise<T> {
  
  // Loop up to maxAttempts times
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Try running our function. If it succeeds, return the result immediately!
      return await fn();
    } catch (error) {
      
      // Check if we still have attempts left after this failure
      const hasAttemptsLeft = attempt < maxAttempts;
      
      // RULE: If the error is NOT retryable (our fault) OR we ran out of attempts, 
      // stop right here and throw the error so it fails loudly.
      if (!isRetryableError(error) || !hasAttemptsLeft) throw error;

      // EXPONENTIAL BACKOFF MATH:
      // The delay doubles with every attempt (500ms -> 1000ms -> 2000ms) 
      // so we don't spam an already crashing server.
      const ceiling = baseDelayMs * 2 ** (attempt - 1); 
      
      // FULL JITTER: 
      // Multiplies by a random number so retries don't hit the server at the exact same millisecond.
      const delay = Math.random() * ceiling; 
      
      console.warn(`attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`);
      
      // Pause code execution for the calculated delay time before the next attempt loop
      await sleep(delay);
    }
  }
  
  // TypeScript safety requirement: The function must always return or throw. 
  // This line is technically unreachable because the loop will throw or return first.
  throw new Error("unreachable"); 
}

// ============================================================================
// FALLBACK SYSTEM: Tries a primary action, and if it fails due to infrastructure, 
// switches over to a backup action.
// ============================================================================
export async function withFallback<T>(
  primary: () => Promise<T>,   // Plan A (e.g., calling our main model)
  fallback: () => Promise<T>   // Plan B (e.g., calling our backup model)
): Promise<T> {
  try {
    // Try running Plan A with our retry-with-backoff protection
    return await retryWithBackoff(primary);
  } catch (error) {
    
    // SAFETY CHECK: If Plan A failed because of OUR mistake (like a typo in a model name),
    // do not use the fallback. Fail immediately so we can fix our code bug.
    if (!isRetryableError(error)) throw error; 
    
    console.warn("primary exhausted, switching to fallback");
    
    // If Plan A failed due to a real server/network outage, 
    // seamlessly switch over and run Plan B (with retry protection)!
    return await retryWithBackoff(fallback);
  }
}