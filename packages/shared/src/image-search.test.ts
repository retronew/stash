import { describe, expect, it } from "vitest";
import { defaultImageSearchSettings, imageSearchUrl, normalizeImageSearchSettings } from "./image-search";

describe("normalizeImageSearchSettings", () => {
  it("falls back to the defaults", () => {
    expect(normalizeImageSearchSettings(null)).toEqual(defaultImageSearchSettings());
  });

  it("drops unknown and repeated engines, keeping the order", () => {
    expect(normalizeImageSearchSettings({ engines: ["yandex", "nope", "google", "yandex"] }).engines).toEqual(["yandex", "google"]);
  });

  it("resets a quick engine that isn't enabled", () => {
    expect(normalizeImageSearchSettings({ engines: ["bing"], quickAction: "google" }).quickAction).toBe("menu");
    expect(normalizeImageSearchSettings({ engines: ["bing"], quickAction: "bing" }).quickAction).toBe("bing");
  });
});

it("encodes the image URL", () => {
  expect(imageSearchUrl("tineye", "https://x.test/a?b=1&c=2")).toBe("https://tineye.com/search?url=https%3A%2F%2Fx.test%2Fa%3Fb%3D1%26c%3D2");
});
