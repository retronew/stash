// Where an export is written. Chrome and Edge can stream straight to a file
// the user picks (File System Access API), so any size works without
// holding it in memory; other browsers build each volume as a Blob and
// download it.

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}

type SaveFilePicker = (options?: SaveFilePickerOptions) => Promise<{ createWritable(): Promise<WritableStream<Uint8Array>> }>;

const picker = (): SaveFilePicker | undefined =>
  typeof window !== "undefined" ? (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker : undefined;

/** Whether this browser can stream a download to disk. */
export function canStreamToDisk(): boolean {
  // Also needs a top-level, secure page (not an iframe preview).
  return !!picker() && window.isSecureContext && window.self === window.top;
}

/**
 * Asks where to save a ZIP. Must run straight from a click (before any
 * other await). Null when the user closes the picker.
 */
export async function pickZipFile(suggestedName: string): Promise<WritableStream<Uint8Array> | null> {
  const show = picker();
  if (!show) return null;
  try {
    const handle = await show({ suggestedName, types: [{ description: "ZIP", accept: { "application/zip": [".zip"] } }] });
    return await handle.createWritable();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
}

/** Downloads a Blob under a file name. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  // Give the download a moment to start before freeing the memory.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
