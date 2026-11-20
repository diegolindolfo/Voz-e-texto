/**
 * Pure rate-limit parsing, retry backoff, and adaptive pacing utilities
 * for resilient Gemini TTS synthesis under strict RPM/RPD quotas.
 */

export function parseRetryDelayMs(errorText: string): number | null {
  if (!errorText) return null;

  // Match Google API JSON field: "retryDelay": "24s" or "12.5s"
  const jsonMatch = errorText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
  if (jsonMatch) {
    const sec = Number.parseFloat(jsonMatch[1]);
    if (Number.isFinite(sec) && sec > 0) {
      return clampDelayMs(Math.ceil(sec * 1000) + 600);
    }
  }

  // Match plain-text API hint: "Please retry in 18.4s" or "retry in 30 seconds"
  const textMatch = errorText.match(/retry\s+in\s+(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)/i);
  if (textMatch) {
    const sec = Number.parseFloat(textMatch[1]);
    if (Number.isFinite(sec) && sec > 0) {
      return clampDelayMs(Math.ceil(sec * 1000) + 600);
    }
  }

  return null;
}

function clampDelayMs(ms: number): number {
  return Math.max(1500, Math.min(65000, Math.round(ms)));
}

export function isDailyQuotaError(errorText: string): boolean {
  if (!errorText) return false;
  return /GenerateRequestsPerDay|PerDay|requests_per_day|per\s+day|daily\s+quota|quota\s+exceeded.*day/i.test(
    errorText,
  );
}

export function isRateLimitError(errorText: string): boolean {
  if (!errorText) return false;
  return /\b429\b|RESOURCE_EXHAUSTED|rate\s*limit|too\s+many\s+requests|quota/i.test(errorText);
}

export function isRetryableGeminiError(errorText: string): boolean {
  if (!errorText) return false;
  if (isDailyQuotaError(errorText)) return false;
  return (
    isRateLimitError(errorText) ||
    /\b(500|502|503|504)\b|UNAVAILABLE|DEADLINE_EXCEEDED|ECONNRESET|ETIMEDOUT/i.test(errorText)
  );
}

export function computeBackoffDelayMs(params: {
  attempt: number;
  errorText: string;
  adaptivePacingMs?: number;
}): number {
  const parsed = parseRetryDelayMs(params.errorText);
  if (parsed !== null) {
    return parsed;
  }

  const baseSchedule = [4000, 9000, 18000, 30000, 45000];
  const scheduled = baseSchedule[Math.min(Math.max(0, params.attempt - 1), baseSchedule.length - 1)];
  const floor = params.adaptivePacingMs ?? 0;
  return clampDelayMs(Math.max(scheduled, floor));
}

/**
 * Coordinates spacing between outgoing Gemini TTS requests so free-tier RPM limits
 * are respected smoothly and automatically backs off when a 429 is encountered.
 */
export class AdaptivePacer {
  private baseSpacingMs: number;
  private currentSpacingMs: number;
  private lastCallCompletedAt = 0;
  private consecutiveSuccesses = 0;

  constructor(baseSpacingMs = 1500) {
    this.baseSpacingMs = Math.max(400, baseSpacingMs);
    this.currentSpacingMs = this.baseSpacingMs;
  }

  getSpacingMs(): number {
    return this.currentSpacingMs;
  }

  setBaseSpacingMs(ms: number): void {
    this.baseSpacingMs = Math.max(400, Math.min(30000, Math.round(ms)));
    this.currentSpacingMs = Math.max(this.baseSpacingMs, this.currentSpacingMs);
  }

  getRequiredWaitMs(now = Date.now(), minOverrideMs = 0): number {
    if (this.lastCallCompletedAt === 0) return 0;
    const spacing = Math.max(this.currentSpacingMs, minOverrideMs);
    const elapsed = now - this.lastCallCompletedAt;
    return Math.max(0, spacing - elapsed);
  }

  recordSuccess(now = Date.now()): void {
    this.lastCallCompletedAt = now;
    this.consecutiveSuccesses += 1;
    // Gently relax adaptive penalty after 3 clean calls in a row
    if (this.consecutiveSuccesses >= 3 && this.currentSpacingMs > this.baseSpacingMs) {
      this.currentSpacingMs = Math.max(this.baseSpacingMs, Math.round(this.currentSpacingMs * 0.75));
      this.consecutiveSuccesses = 0;
    }
  }

  recordRateLimit(retryDelayMs?: number | null, now = Date.now()): void {
    this.lastCallCompletedAt = now;
    this.consecutiveSuccesses = 0;
    const bumped = Math.max(this.currentSpacingMs * 1.8, retryDelayMs ?? 8000);
    this.currentSpacingMs = Math.min(25000, Math.round(bumped));
  }
}
