import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AdaptivePacer,
  computeBackoffDelayMs,
  isDailyQuotaError,
  isRateLimitError,
  isRetryableGeminiError,
  parseRetryDelayMs,
} from './rateLimit';

test('parseRetryDelayMs extracts retryDelay from Google JSON and plain-text errors', () => {
  const jsonErr = '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","details":[{"retryDelay":"18s"}]}}';
  assert.equal(parseRetryDelayMs(jsonErr), 18600);

  const textErr = 'Quota exceeded. Please retry in 12.5s.';
  assert.equal(parseRetryDelayMs(textErr), 13100);

  assert.equal(parseRetryDelayMs('Unknown network failure'), null);
});

test('isDailyQuotaError distinguishes hard daily RPD exhaustion from transient RPM 429', () => {
  const dailyErr = '429 RESOURCE_EXHAUSTED: GenerateRequestsPerDayPerProjectPerModel exceeded';
  const minuteErr = '429 RESOURCE_EXHAUSTED: GenerateRequestsPerMinutePerProjectPerModel exceeded';

  assert.equal(isDailyQuotaError(dailyErr), true);
  assert.equal(isRetryableGeminiError(dailyErr), false);

  assert.equal(isDailyQuotaError(minuteErr), false);
  assert.equal(isRateLimitError(minuteErr), true);
  assert.equal(isRetryableGeminiError(minuteErr), true);
});

test('computeBackoffDelayMs respects parsed retryDelay or escalates smoothly', () => {
  assert.equal(
    computeBackoffDelayMs({ attempt: 1, errorText: '{"retryDelay":"9s"}' }),
    9600,
  );
  assert.equal(
    computeBackoffDelayMs({ attempt: 1, errorText: '429 RESOURCE_EXHAUSTED' }),
    4000,
  );
  assert.equal(
    computeBackoffDelayMs({ attempt: 3, errorText: '429 RESOURCE_EXHAUSTED' }),
    18000,
  );
});

test('AdaptivePacer increases spacing after 429 and relaxes after consecutive successes', () => {
  const pacer = new AdaptivePacer(1500);
  assert.equal(pacer.getRequiredWaitMs(10000), 0);

  pacer.recordRateLimit(10000, 10000);
  assert.ok(pacer.getSpacingMs() >= 10000);
  assert.equal(pacer.getRequiredWaitMs(12000), pacer.getSpacingMs() - 2000);

  const peaked = pacer.getSpacingMs();
  pacer.recordSuccess(25000);
  pacer.recordSuccess(40000);
  pacer.recordSuccess(55000);
  assert.ok(pacer.getSpacingMs() < peaked);
});
