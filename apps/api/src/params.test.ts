import { describe, expect, it } from "vitest";
import { cursorParam, inClause, limitParam, listParam } from "./params";

describe("listParam", () => {
  it("splits, trims and de-duplicates", () => {
    expect(listParam(" a, b,,a ")).toEqual(["a", "b"]);
    expect(listParam(undefined)).toEqual([]);
  });

  it("drops values outside the allowed set", () => {
    expect(listParam("pending,nope,failed", ["pending", "failed"] as const)).toEqual(["pending", "failed"]);
  });
});

describe("cursorParam / limitParam", () => {
  it("accepts only positive integers as cursors", () => {
    expect(cursorParam("12")).toBe(12);
    expect(cursorParam("0")).toBeUndefined();
    expect(cursorParam("x")).toBeUndefined();
  });

  it("clamps the page size", () => {
    expect(limitParam(undefined, 30)).toBe(30);
    expect(limitParam("500", 30)).toBe(100);
    expect(limitParam("-3", 30)).toBe(1);
  });
});

describe("inClause", () => {
  it("adds one placeholder per value", () => {
    const params: unknown[] = [1];
    expect(inClause("a.status", ["x", "y"], params)).toBe("a.status IN (?, ?)");
    expect(params).toEqual([1, "x", "y"]);
  });
});
