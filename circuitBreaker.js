/**
 * Circuit Breaker Pattern
 * Protects downstream services from cascading failures by failing fast.
 * States:
 *   - CLOSED: Normal operation; requests pass through.
 *   - OPEN: Threshold exceeded; calls fail immediately without hitting the service.
 *   - HALF_OPEN: Trial period; tests if downstream service has recovered.
 */

const State = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

class CircuitBreaker {
  constructor(asyncFn, options = {}) {
    this.asyncFn = asyncFn;
    this.failureThreshold = options.failureThreshold || 3; // Failures before opening
    this.resetTimeout = options.resetTimeout || 5000;       // Cooldown duration in ms
    this.state = State.CLOSED;
    this.failureCount = 0;
    this.nextAttempt = Date.now();
  }

  async fire(...args) {
    if (this.state === State.OPEN) {
      if (Date.now() > this.nextAttempt) {
        this.state = State.HALF_OPEN;
        console.log('[CircuitBreaker] State -> HALF_OPEN (probing downstream service)...');
      } else {
        const remainingSeconds = Math.ceil((this.nextAttempt - Date.now()) / 1000);
        throw new Error(
          `Circuit is OPEN! Fast-failing request. Next retry allowed in ${remainingSeconds}s`
        );
      }
    }

    try {
      const result = await this.asyncFn(...args);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = State.CLOSED;
  }

  onFailure() {
    this.failureCount++;
    console.warn(`[CircuitBreaker] Failure ${this.failureCount}/${this.failureThreshold}`);

    if (this.state === State.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      this.state = State.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.warn(`[CircuitBreaker] State -> OPEN. Paused for ${this.resetTimeout}ms`);
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      resetTimeoutMs: this.resetTimeout,
      nextAttempt: this.state === State.OPEN ? new Date(this.nextAttempt).toISOString() : null,
    };
  }
}

module.exports = { CircuitBreaker, State };
