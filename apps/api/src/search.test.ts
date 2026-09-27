import { describe, expect, it } from "vitest";
import { ftsQuery } from "./search";

describe("ftsQuery", () => {
  it("quotes each word of 3+ characters and requires all of them", () => {
    expect(ftsQuery(" 高铁票  北京 ")).toBe('"高铁票"');
    expect(ftsQuery('say "hi" there')).toBe('"say" AND """hi""" AND "there"');
  });

  it("is empty when every word is too short for trigrams", () => {
    expect(ftsQuery("北京 ab")).toBe("");
  });
});
