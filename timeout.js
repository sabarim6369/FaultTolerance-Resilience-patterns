/**
 * Timeout Pattern
 * Rejects an operation if it takes longer than a specified duration.
 * Prevents downstream slow services from hanging client requests indefinitely.
 */

function withTimeout(asyncFn, timeoutMs = 2000) {
  return async function (...args) {
    let timer;

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([asyncFn(...args), timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  };
}

module.exports = { withTimeout };
