import * as WMF from "wmf";
import { convertWmfToDataUrl, convertEmfToDataUrl } from "emf-converter";


async function cropWhitespaceFromPngDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image/png")) return dataUrl;
  if (typeof document === "undefined") return dataUrl;

  try {
    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Không giải mã được PNG sau chuyển đổi WMF/EMF."));
    });
    img.src = dataUrl;
    await loaded;

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return dataUrl;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const d = imageData.data;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    // Treat near-white pixels as background. This is intentionally conservative
    // so black/colored vectors, graphs and variation tables are preserved.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const a = d[i + 3];
        const isVisibleInk = a > 20 && (r < 248 || g < 248 || b < 248);
        if (isVisibleInk) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return dataUrl;

    const inkW = maxX - minX + 1;
    const inkH = maxY - minY + 1;

    // If the converter already produced a tight image, do not resample it.
    const occupancy = (inkW * inkH) / (width * height);
    const verticalWaste = 1 - inkH / height;
    const horizontalWaste = 1 - inkW / width;
    if (occupancy > 0.72 && verticalWaste < 0.18 && horizontalWaste < 0.18) {
      return dataUrl;
    }

    const pad = Math.max(8, Math.round(Math.max(inkW, inkH) * 0.03));
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const ex = Math.min(width - 1, maxX + pad);
    const ey = Math.min(height - 1, maxY + pad);
    const sw = ex - sx + 1;
    const sh = ey - sy + 1;

    // Avoid pathological crops caused by a single stray pixel.
    if (sw < 12 || sh < 12) return dataUrl;

    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    const outCtx = out.getContext("2d");
    if (!outCtx) return dataUrl;
    outCtx.fillStyle = "#ffffff";
    outCtx.fillRect(0, 0, sw, sh);
    outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return out.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}

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
      const pngUrl = await convertWmfToDataUrl(buffer, { maxWidth: 1000, maxHeight: 800, dpiScale: 1.5 });
      if (pngUrl && pngUrl.startsWith("data:image/png") && pngUrl.length > 200) {
        return await cropWhitespaceFromPngDataUrl(pngUrl);
      }
    } catch (err1) {
      // Continue to next attempts
    }

    // 2. Try emf-converter as EMF with bounded size
    try {
      const emfUrl = await convertEmfToDataUrl(buffer, { maxWidth: 1000, maxHeight: 800, dpiScale: 1.5 });
      if (emfUrl && emfUrl.startsWith("data:image/png") && emfUrl.length > 200) {
        return await cropWhitespaceFromPngDataUrl(emfUrl);
      }
    } catch (err2) {
      // Continue
    }

    // 3. Fallback: SheetJS WMF with Aldus header stripping
    const stripped = stripAldusHeader(u8);
    const canvas = document.createElement("canvas");
    try {
      WMF.draw_canvas(stripped, canvas);
      if (canvas.width > 0 && canvas.height > 0) {
        return await cropWhitespaceFromPngDataUrl(canvas.toDataURL("image/png"));
      }
    } catch (wmfErr) {
      // Try raw buffer without stripping
      try {
        WMF.draw_canvas(u8, canvas);
        if (canvas.width > 0 && canvas.height > 0) {
          return await cropWhitespaceFromPngDataUrl(canvas.toDataURL("image/png"));
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

    try {
      WMF.draw_canvas(stripped, canvas);
      if (canvas.width > 0 && canvas.height > 0) {
        return canvas.toDataURL("image/png");
      }
    } catch (e1) {
      try {
        WMF.draw_canvas(u8, canvas);
        if (canvas.width > 0 && canvas.height > 0) {
          return canvas.toDataURL("image/png");
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
