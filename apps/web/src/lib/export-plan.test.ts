import { describe, expect, it } from "vitest";
import { emptyFields, type Attachment, type Message } from "@stash/shared";
import { dateRange, entryPath, extensionOf, planFiles, safeName, splitVolumes, zipName } from "./export-plan";

const att = (over: Partial<Attachment> = {}): Attachment => ({
  id: 7,
  kind: "image",
  filename: "IMG.JPG",
  contentType: "image/jpeg",
  size: 100,
  width: null,
  height: null,
  status: "stored",
  storedSize: 100,
  attempts: 1,
  lastError: "",
  storedAt: 1,
  ...over,
});

const msg = (over: Partial<Message> = {}): Message => ({
  id: 1,
  accountId: "b1",
  platform: "qq",
  chatType: "c2c",
  chatId: "U1",
  senderId: "U1",
  senderName: "小明",
  text: "hi",
  sentAt: new Date(2026, 8, 27, 15, 30, 12).getTime(),
  receivedAt: 0,
  attachments: [att()],
  category: "",
  tags: [],
  summary: "",
  ocrText: "",
  fields: emptyFields(),
  aiStatus: "",
  aiError: "",
  ...over,
});

describe("entryPath", () => {
  it("sorts by time and stays unique per attachment", () => {
    expect(entryPath(att(), msg(), "My Bot", "bot")).toBe("My Bot/2026-09/0927-153012_小明_7.jpg");
    expect(entryPath(att(), msg(), "b", "chat")).toBe("b/c2c-U1/0927-153012_小明_7.jpg");
    expect(entryPath(att(), msg(), "b", "flat")).toBe("0927-153012_小明_7.jpg");
  });

  it("cleans characters file systems reject", () => {
    expect(safeName('a/b:c*?"<>|')).toBe("a_b_c______");
    expect(safeName("  ..hidden ")).toBe("hidden");
    expect(safeName("", "x")).toBe("x");
  });
});

describe("extensionOf", () => {
  it("prefers the file name, then the MIME type", () => {
    expect(extensionOf({ filename: "a.PNG", contentType: "image/jpeg" })).toBe("png");
    expect(extensionOf({ filename: "", contentType: "image/webp" })).toBe("webp");
    expect(extensionOf({ filename: "", contentType: "x/y" })).toBe("bin");
  });
});

describe("planFiles", () => {
  it("keeps the chosen kinds and separates unsaved files", () => {
    const m = msg({
      attachments: [att({ id: 1 }), att({ id: 2, kind: "video" }), att({ id: 3, status: "failed" })],
    });
    const { files, unsaved } = planFiles([m], ["image"], () => "b", "flat");
    expect(files.map((f) => f.attachment.id)).toEqual([1]);
    expect(unsaved.map((f) => f.attachment.id)).toEqual([3]);
  });
});

describe("splitVolumes", () => {
  it("fills volumes up to the limit, giving an oversized file its own", () => {
    expect(splitVolumes([3, 3, 3, 9, 1], (n) => n, 6)).toEqual([[3, 3], [3], [9], [1]]);
    expect(splitVolumes([], (n: number) => n, 6)).toEqual([]);
  });
});

describe("names and dates", () => {
  it("names volumes by platform and date", () => {
    const d = new Date(2026, 8, 27);
    expect(zipName(["qq"], 1, 1, d)).toBe("stash-qq-20260927.zip");
    expect(zipName(["qq"], 2, 3, d)).toBe("stash-qq-20260927-part2of3.zip");
    // With a single platform, "none chosen" means that one.
    expect(zipName([], 1, 1, d)).toBe("stash-qq-20260927.zip");
  });

  it("makes the end date inclusive", () => {
    const { since, until } = dateRange("2026-09-01", "2026-09-01");
    expect(until! - since!).toBe(86_400_000);
    expect(dateRange("", "")).toEqual({ since: undefined, until: undefined });
  });
});
