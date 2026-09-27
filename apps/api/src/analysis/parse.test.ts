import { describe, expect, it } from "vitest";
import { embeddingInput, NoJsonError, parseAnalysis } from "./parse";

describe("parseAnalysis", () => {
  it("reads JSON wrapped in a code fence and snaps to existing categories", () => {
    const reply =
      'Sure:\n```json\n{"category": " 票 据", "tags": ["发票", "发票", "餐饮"], "summary": "一张餐厅发票",' +
      ' "ocr_text": "金额 ¥128.00", "fields": {"amounts": ["¥128.00", 5], "codes": ["INV-001"], "nope": ["x"]}}\n```';
    const r = parseAnalysis(reply, ["工作", "票据"]);
    expect(r.category).toBe("票据");
    expect(r.tags).toEqual(["发票", "餐饮"]);
    expect(r.summary).toBe("一张餐厅发票");
    expect(r.ocrText).toBe("金额 ¥128.00");
    expect(r.fields.amounts).toEqual(["¥128.00", "5"]);
    expect(r.fields.codes).toEqual(["INV-001"]);
    expect(r.fields.phones).toEqual([]);
  });

  it("keeps a new category and fills in what's missing", () => {
    const r = parseAnalysis('{"category": "宠物"}', ["工作"]);
    expect(r).toMatchObject({ category: "宠物", tags: [], summary: "", ocrText: "" });
  });

  it("rejects replies without JSON", () => {
    expect(() => parseAnalysis("I can't see the image", [])).toThrow(NoJsonError);
    expect(() => parseAnalysis("{not json}", [])).toThrow(NoJsonError);
  });
});

describe("embeddingInput", () => {
  it("joins the searchable parts, skipping empty ones", () => {
    expect(embeddingInput({ category: "票据", tags: ["发票"], summary: "s", text: "", ocrText: "o" })).toBe("票据\n发票\ns\no");
  });
});
