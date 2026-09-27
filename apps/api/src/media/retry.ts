// When to try a failed download again. Delays add up to about 5 hours, well
// inside the free plan's 24-hour queue retention; after the last attempt the
// attachment is marked failed and can be retried by hand from the web app.

export const RETRY_DELAYS_SECONDS = [30, 120, 300, 900, 1800, 3600, 3600, 7200];

/** Attempts in total: the first try plus one per delay. */
export const MAX_ATTEMPTS = RETRY_DELAYS_SECONDS.length + 1;

/** Delay before the next attempt, after `attempts` have failed; null = give up. */
export function nextDelaySeconds(attempts: number): number | null {
  return attempts >= MAX_ATTEMPTS ? null : RETRY_DELAYS_SECONDS[Math.max(0, attempts - 1)];
}

/** A download error; `retryable` false means trying again can't help (e.g. the link expired). */
export class DownloadError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** Timeouts, rate limits and server errors are worth retrying; other 4xx are not. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}
