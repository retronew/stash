import { describe, expect, it } from "vitest";
import { attachmentKind, normalizeUrl, parseMessageEvent } from "./events";

describe("parseMessageEvent", () => {
  it("maps a C2C message with an image", () => {
    const payload = {
      op: 0,
      t: "C2C_MESSAGE_CREATE",
      d: {
        id: "ROBOT1.0_abc",
        content: " hello ",
        timestamp: "2026-09-27T10:00:00+08:00",
        author: { user_openid: "USER1" },
        attachments: [
          {
            content_type: "image/jpeg",
            filename: "A.jpg",
            url: "multimedia.nt.qq.com.cn/download?appid=1407&fileid=x",
            size: "2048",
            width: 800,
            height: 600,
          },
        ],
      },
    };
    const msg = parseMessageEvent(payload, "raw")!;
    expect(msg).toMatchObject({
      externalId: "ROBOT1.0_abc",
      chatType: "c2c",
      chatId: "USER1",
      senderId: "USER1",
      text: "hello",
      sentAt: Date.parse("2026-09-27T02:00:00Z"),
    });
    expect(msg.attachments).toEqual([
      {
        kind: "image",
        url: "https://multimedia.nt.qq.com.cn/download?appid=1407&fileid=x",
        filename: "A.jpg",
        contentType: "image/jpeg",
        size: 2048,
        width: 800,
        height: 600,
      },
    ]);
  });

  it("uses the group as the chat of a group message", () => {
    const msg = parseMessageEvent(
      { op: 0, t: "GROUP_AT_MESSAGE_CREATE", d: { id: "1", group_openid: "G", author: { member_openid: "M" } } },
      "",
    );
    expect(msg).toMatchObject({ chatType: "group", chatId: "G", senderId: "M" });
  });

  it("ignores other events and messages without an id", () => {
    expect(parseMessageEvent({ op: 0, t: "FRIEND_ADD", d: { id: "1" } }, "")).toBeNull();
    expect(parseMessageEvent({ op: 0, t: "C2C_MESSAGE_CREATE", d: {} }, "")).toBeNull();
  });
});

describe("attachmentKind", () => {
  it("reads the MIME type, then the file name", () => {
    expect(attachmentKind("image/png", "")).toBe("image");
    expect(attachmentKind("video/mp4", "")).toBe("video");
    expect(attachmentKind("voice", "")).toBe("audio");
    expect(attachmentKind("file", "IMG_1.HEIC")).toBe("image");
    expect(attachmentKind("file", "report.pdf")).toBe("file");
  });
});

describe("normalizeUrl", () => {
  it("adds https to scheme-less URLs only", () => {
    expect(normalizeUrl("gchat.qpic.cn/a")).toBe("https://gchat.qpic.cn/a");
    expect(normalizeUrl("//gchat.qpic.cn/a")).toBe("https://gchat.qpic.cn/a");
    expect(normalizeUrl("http://x.cn/a")).toBe("http://x.cn/a");
  });
});
