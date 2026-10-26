const express = require('express');
const { withTimeout } = require('./timeout');
const { withRetry } = require('./retry');
const { Bulkhead } = require('./bulkhead');
const { CircuitBreaker } = require('./circuitBreaker');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ---------------------------------------------------------------------
// 1. TIMEOUT PATTERN DEMO
// ---------------------------------------------------------------------
// Simulated service that takes a variable amount of time to respond
async function slowService(delayMs) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return { message: `Service finished successfully after ${delayMs}ms` };
}

// Wrap the slow service with a 2000ms timeout
const slowServiceWithTimeout = withTimeout(slowService, 2000);

app.get('/timeout', async (req, res) => {
  const delay = parseInt(req.query.delay || '1000', 10);
  console.log(`\n--- [Timeout Demo] Calling service with delay: ${delay}ms (Limit: 2000ms) ---`);

  try {
    const result = await slowServiceWithTimeout(delay);
    res.json({ status: 'SUCCESS', delay, result });
  } catch (err) {
    res.status(504).json({
      status: 'TIMEOUT_ERROR',
      delay,
      error: err.message,
    });
  }
});

// ---------------------------------------------------------------------
// 2. RETRY PATTERN DEMO
// ---------------------------------------------------------------------
// Tracks failure simulation for retry
let retryAttemptsSoFar = 0;

app.get('/retry', async (req, res) => {
  const failTimes = parseInt(req.query.failTimes || '2', 10);
  retryAttemptsSoFar = 0;

  console.log(`\n--- [Retry Demo] Will fail ${failTimes} times before succeeding (Max: 3 retries) ---`);

  // Simulated unreliable service
  const unreliableService = async (attempt) => {
    retryAttemptsSoFar = attempt;
    if (attempt <= failTimes) {
      throw new Error(`Transient error at attempt #${attempt}`);
    }
    return `Data fetched successfully on attempt #${attempt}`;
  };

  try {
    const result = await withRetry(unreliableService, 3, 400);
    res.json({
      status: 'SUCCESS',
      configuredFailures: failTimes,
      totalAttemptsTaken: retryAttemptsSoFar,
      result,
    });
  } catch (err) {
    res.status(500).json({
      status: 'RETRY_EXHAUSTED',
      configuredFailures: failTimes,
      totalAttemptsTaken: retryAttemptsSoFar,
      error: err.message,
    });
  }
});

// ---------------------------------------------------------------------
// 3. BULKHEAD PATTERN DEMO
// ---------------------------------------------------------------------
// Max 2 concurrent operations, max 2 queued, any more are rejected immediately
const bulkhead = new Bulkhead(2, 2);

app.get('/bulkhead', async (req, res) => {
  console.log(`\n--- [Bulkhead Demo] Incoming request. Current:`, bulkhead.getStatus(), `---`);

  try {
    const result = await bulkhead.execute(async () => {
      // Simulate heavy or slow operation (2.5 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2500));
      return 'Task finished processing within bulkhead capacity';
    });

    res.json({
      status: 'SUCCESS',
      result,
      bulkheadStatus: bulkhead.getStatus(),
    });
  } catch (err) {
    res.status(429).json({
      status: 'BULKHEAD_REJECTED',
      error: err.message,
      bulkheadStatus: bulkhead.getStatus(),
    });
  }
});

app.get('/bulkhead/status', (req, res) => {
  res.json(bulkhead.getStatus());
});

// ---------------------------------------------------------------------
// 4. CIRCUIT BREAKER PATTERN DEMO
// ---------------------------------------------------------------------
// Simulated downstream service that can succeed or fail based on query
async function downstreamApi(shouldFail) {
  if (shouldFail) {
    throw new Error('Downstream API returned 500 Internal Server Error');
  }
  return { data: 'Downstream API response OK' };
}

// 3 failures opens the circuit for 5000ms cooldown
const circuitBreaker = new CircuitBreaker(downstreamApi, {
  failureThreshold: 3,
  resetTimeout: 5000,
});

app.get('/circuit-breaker/call', async (req, res) => {
  const shouldFail = req.query.fail === 'true';
  console.log(`\n--- [Circuit Breaker Demo] Calling with fail=${shouldFail} ---`);

  try {
    const result = await circuitBreaker.fire(shouldFail);
    res.json({
      status: 'SUCCESS',
      result,
      circuitBreaker: circuitBreaker.getStatus(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'FAILED',
      error: err.message,
      circuitBreaker: circuitBreaker.getStatus(),
    });
  }
});

app.get('/circuit-breaker/status', (req, res) => {
  res.json(circuitBreaker.getStatus());
});

// ---------------------------------------------------------------------
// ROOT / INDEX ROUTE
// ---------------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    title: 'Fault Tolerance & Resilience Patterns Demo',
    patterns: [
      {
        pattern: 'Timeout',
        description: 'Aborts operations exceeding 2000ms',
        endpoints: [
          'GET /timeout?delay=1000 (Succeeds within timeout)',
          'GET /timeout?delay=3000 (Fails with 504 Timeout)',
        ],
      },
      {
        pattern: 'Retry',
        description: 'Retries transient errors up to 3 times',
        endpoints: [
          'GET /retry?failTimes=2 (Succeeds on 3rd attempt)',
          'GET /retry?failTimes=4 (Exhausts retries and returns 500)',
        ],
      },
      {
        pattern: 'Bulkhead',
        description: 'Limits concurrent executions (max 2 active, 2 queued)',
        endpoints: [
          'GET /bulkhead (Takes 2.5s. Send 5 parallel requests to see rejection)',
          'GET /bulkhead/status',
        ],
      },
      {
        pattern: 'Circuit Breaker',
        description: 'Trips OPEN after 3 failures, waits 5s before HALF_OPEN probe',
        endpoints: [
          'GET /circuit-breaker/call?fail=false (Successful call)',
          'GET /circuit-breaker/call?fail=true (Trigger failure)',
          'GET /circuit-breaker/status (View state: CLOSED, OPEN, HALF_OPEN)',
        ],
      },
    ],
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`Resilience Patterns Server running on http://localhost:${PORT}`);
  console.log(`=================================================`);
});
