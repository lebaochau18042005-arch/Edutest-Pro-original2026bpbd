import * as WMF from "wmf";
import { convertWmfToDataUrl, convertEmfToDataUrl } from "emf-converter";

/**
 * Strips the 22-byte Aldus Placeable Metafile (APM) header if present.
 * APM header magic: 0x9AC6CDD7 (D7 CD C6 9A)
 */
export function stripAldusHeader(u8: Uint8Array): Uint8Array {
  if (
    u8.length >= 22 &&
    u8[0] === 0xd7 &&
    u8[1] === 0xcd &&
    u8[2] === 0xc6 &&
    u8[3] === 0x9a
  ) {
    return u8.subarray(22);
  }
  return u8;
}

/**
 * Asynchronously converts a WMF or EMF ArrayBuffer / Uint8Array to a high-definition PNG Data URI.
 * Uses emf-converter (GDI+ & 16/32-bit records) with intelligent fallback to SheetJS WMF canvas renderer.
 */
export async function convertMetafileBufferToPng(
  wmfData: Uint8Array | ArrayBuffer
): Promise<string | null> {
  try {
    if (typeof document === "undefined" && typeof OffscreenCanvas === "undefined") {
      return null;
    }

    const u8 = wmfData instanceof Uint8Array ? wmfData : new Uint8Array(wmfData);
    if (!u8 || u8.length === 0) return null;

    const buffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);

    // 1. Try emf-converter as WMF with bounded size
    try {
      const pngUrl = await convertWmfToDataUrl(buffer, { maxWidth: 1200, maxHeight: 1000, dpiScale: 2 });
      if (pngUrl && pngUrl.startsWith("data:image/png") && pngUrl.length > 200) {
        return pngUrl;
      }
    } catch (err1) {
      // Continue to next attempts
    }

    // 1b. Try stripped buffer with emf-converter
    try {
      const stripped = stripAldusHeader(u8);
      const strippedBuf = stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.byteLength);
      const pngUrl = await convertWmfToDataUrl(strippedBuf, { maxWidth: 1200, maxHeight: 1000, dpiScale: 2 });
      if (pngUrl && pngUrl.startsWith("data:image/png") && pngUrl.length > 200) {
        return pngUrl;
      }
    } catch (err1b) {
      // Continue
    }

    // 2. Try emf-converter as EMF with bounded size
    try {
      const emfUrl = await convertEmfToDataUrl(buffer, { maxWidth: 1200, maxHeight: 1000, dpiScale: 2 });
      if (emfUrl && emfUrl.startsWith("data:image/png") && emfUrl.length > 200) {
        return emfUrl;
      }
    } catch (err2) {
      // Continue
    }

    // 2b. Try stripped buffer as EMF
    try {
      const stripped = stripAldusHeader(u8);
      const strippedBuf = stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.byteLength);
      const emfUrl = await convertEmfToDataUrl(strippedBuf, { maxWidth: 1200, maxHeight: 1000, dpiScale: 2 });
      if (emfUrl && emfUrl.startsWith("data:image/png") && emfUrl.length > 200) {
        return emfUrl;
      }
    } catch (err2b) {
      // Continue
    }

    // 3. Fallback: SheetJS WMF with Aldus header stripping
    const stripped = stripAldusHeader(u8);
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    try {
      WMF.draw_canvas(stripped, canvas);
      if (canvas.width > 0 && canvas.height > 0) {
        const url = canvas.toDataURL("image/png");
        if (url && url.length > 200) return url;
      }
    } catch (wmfErr) {
      // Try raw buffer without stripping
      try {
        WMF.draw_canvas(u8, canvas);
        if (canvas.width > 0 && canvas.height > 0) {
          const url = canvas.toDataURL("image/png");
          if (url && url.length > 200) return url;
        }
      } catch (e3) {
        // Fallback failed
      }
    }
  } catch (e) {
    console.warn("convertMetafileBufferToPng error:", e);
  }

  return null;
}

/**
 * Synchronous WMF buffer to PNG converter using Canvas.
 */
export function convertWmfBufferToPng(wmfData: Uint8Array | ArrayBuffer): string | null {
  try {
    if (typeof document === "undefined") return null;
    const u8 = wmfData instanceof Uint8Array ? wmfData : new Uint8Array(wmfData);
    if (!u8 || u8.length === 0) return null;

    const stripped = stripAldusHeader(u8);
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;

    try {
      WMF.draw_canvas(stripped, canvas);
      if (canvas.width > 0 && canvas.height > 0) {
        const url = canvas.toDataURL("image/png");
        if (url && url.length > 200) return url;
      }
    } catch (e1) {
      try {
        WMF.draw_canvas(u8, canvas);
        if (canvas.width > 0 && canvas.height > 0) {
          const url = canvas.toDataURL("image/png");
          if (url && url.length > 200) return url;
        }
      } catch (e2) {
        // Fallback failed
      }
    }
  } catch (e) {
    console.warn("WMF to Canvas conversion note:", e);
  }
  return null;
}

/**
 * Converts a WMF or EMF data URI (e.g. `data:image/wmf;base64,...` or `data:image/x-wmf;base64,...`)
 * to a standard PNG data URI that any browser can render immediately.
 */
export function convertWmfDataUriToPng(dataUri: string): string {
  if (
    !dataUri ||
    (!dataUri.startsWith("data:image/wmf") &&
      !dataUri.startsWith("data:image/x-wmf") &&
      !dataUri.startsWith("data:image/emf") &&
      !dataUri.startsWith("data:image/x-emf"))
  ) {
    return dataUri;
  }

  try {
    const base64Index = dataUri.indexOf("base64,");
    if (base64Index === -1) return dataUri;
    const b64 = dataUri.substring(base64Index + 7).replace(/\s+/g, "");
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const png = convertWmfBufferToPng(bytes);
    if (png) return png;
  } catch (err) {
    console.warn("convertWmfDataUriToPng sync error:", err);
  }

  return dataUri;
}

/**
 * Asynchronously converts any WMF/EMF data URI to PNG
 */
export async function convertWmfDataUriToPngAsync(dataUri: string): Promise<string> {
  if (
    !dataUri ||
    (!dataUri.startsWith("data:image/wmf") &&
      !dataUri.startsWith("data:image/x-wmf") &&
      !dataUri.startsWith("data:image/emf") &&
      !dataUri.startsWith("data:image/x-emf"))
  ) {
    return dataUri;
  }

  try {
    const base64Index = dataUri.indexOf("base64,");
    if (base64Index === -1) return dataUri;
    const b64 = dataUri.substring(base64Index + 7).replace(/\s+/g, "");
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const png = await convertMetafileBufferToPng(bytes);
    if (png) return png;
  } catch (err) {
    console.warn("convertWmfDataUriToPngAsync error:", err);
  }

  return dataUri;
}
