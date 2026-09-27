const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/heic": "heic",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "audio/amr": "amr",
  "audio/silk": "silk",
  "audio/mpeg": "mp3",
};

/** File extension from the filename, else the content type, else "bin". */
export function extensionFor(filename: string, contentType: string): string {
  const fromName = /\.([A-Za-z0-9]{1,8})$/.exec(filename)?.[1];
  if (fromName) return fromName.toLowerCase();
  return EXTENSIONS[contentType.split(";")[0].trim().toLowerCase()] ?? "bin";
}

/** media/<platform>/<yyyy>/<mm>/<attachment id>.<ext>, dated by when it was received. */
export function mediaKey(platform: string, attachmentId: number, receivedAt: number, ext: string): string {
  const d = new Date(receivedAt);
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `media/${platform}/${d.getUTCFullYear()}/${month}/${attachmentId}.${ext}`;
}
