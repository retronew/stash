import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, RETRY_DELAYS_SECONDS, isRetryableStatus, nextDelaySeconds } from "./retry";
import { extensionFor, mediaKey } from "./keys";

describe("nextDelaySeconds", () => {
  it("backs off, then gives up after the last attempt", () => {
    expect(nextDelaySeconds(1)).toBe(RETRY_DELAYS_SECONDS[0]);
    expect(nextDelaySeconds(2)).toBe(RETRY_DELAYS_SECONDS[1]);
    expect(nextDelaySeconds(MAX_ATTEMPTS - 1)).toBe(RETRY_DELAYS_SECONDS.at(-1));
    expect(nextDelaySeconds(MAX_ATTEMPTS)).toBeNull();
  });

  it("stays inside the free plan's 24-hour queue retention", () => {
    expect(RETRY_DELAYS_SECONDS.reduce((a, b) => a + b, 0)).toBeLessThan(12 * 3600);
  });
});

describe("isRetryableStatus", () => {
  it("retries server errors and rate limits, not missing or forbidden files", () => {
    for (const s of [408, 429, 500, 502, 503]) expect(isRetryableStatus(s)).toBe(true);
    for (const s of [400, 403, 404, 410]) expect(isRetryableStatus(s)).toBe(false);
  });
});

describe("media keys", () => {
  it("prefers the file name's extension, then the MIME type", () => {
    expect(extensionFor("a.PNG", "image/jpeg")).toBe("png");
    expect(extensionFor("", "image/jpeg; charset=binary")).toBe("jpg");
    expect(extensionFor("", "application/x-unknown")).toBe("bin");
  });

  it("groups files by platform and month", () => {
    expect(mediaKey("qq", 42, Date.UTC(2026, 8, 27), "jpg")).toBe("media/qq/2026/09/42.jpg");
  });
});
