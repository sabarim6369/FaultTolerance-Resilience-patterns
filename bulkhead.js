/**
 * Bulkhead Pattern
 * Isolates resources by limiting the number of concurrent executions.
 * Prevents a single overloaded component from exhausting server capacity.
 */

class Bulkhead {
  constructor(maxConcurrent = 2, maxQueue = 2) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueue = maxQueue;
    this.activeCount = 0;
    this.queue = [];
  }

  async execute(asyncFn) {
    // If active pool is full, try queuing
    if (this.activeCount >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        throw new Error(
          `Bulkhead full: Max concurrency (${this.maxConcurrent}) and queue (${this.maxQueue}) exceeded`
        );
      }

      // Wait in queue for an available execution slot
      await new Promise((resolve) => this.queue.push(resolve));
    }

    this.activeCount++;
    try {
      return await asyncFn();
    } finally {
      this.activeCount--;

      // Release next in line from the queue if any
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }

  getStatus() {
    return {
      activeCalls: this.activeCount,
      queuedCalls: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueue: this.maxQueue,
    };
  }
}

module.exports = { Bulkhead };
