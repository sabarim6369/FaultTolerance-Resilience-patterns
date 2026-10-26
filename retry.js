/**
 * Retry Pattern
 * Automatically retries a failed operation up to `maxRetries` times.
 * Handles transient faults (temporary network glitches, momentary service unavailability).
 */

async function withRetry(asyncFn, maxRetries = 3, delayMs = 500) {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      attempts++;
      return await asyncFn(attempts);
    } catch (err) {
      console.warn(`[Retry] Attempt ${attempts} failed: ${err.message}`);

      if (attempts >= maxRetries) {
        throw new Error(`All ${maxRetries} retry attempts failed: ${err.message}`);
      }

      // Wait before the next attempt
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

module.exports = { withRetry };
