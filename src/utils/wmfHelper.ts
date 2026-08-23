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
 * Crop the oversized white/transparent canvas commonly produced by WMF/EMF
 * renderers. MathType formulas otherwise appear as a tiny black mark inside a
 * large blank card in the exam preview.
 */
function cropCanvasToVisibleContent(canvas: HTMLCanvasElement): string | null {
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || canvas.width <= 0 || canvas.height <= 0) return null;

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const offset = (y * canvas.width + x) * 4;
        const alpha = pixels[offset + 3];
        if (alpha <= 8) continue;

        const red = pixels[offset];
        const green = pixels[offset + 1];
        const blue = pixels[offset + 2];
        const isNearWhite = red >= 248 && green >= 248 && blue >= 248;
        if (isNearWhite) continue;

        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    // A valid PNG can still be completely blank. Let another renderer try.
    if (maxX < minX || maxY < minY) return null;

    const margin = Math.max(4, Math.round(Math.min(canvas.width, canvas.height) * 0.01));
    const sourceX = Math.max(0, minX - margin);
    const sourceY = Math.max(0, minY - margin);
    const sourceRight = Math.min(canvas.width, maxX + margin + 1);
    const sourceBottom = Math.min(canvas.height, maxY + margin + 1);
    const width = Math.max(1, sourceRight - sourceX);
    const height = Math.max(1, sourceBottom - sourceY);

    if (width >= canvas.width * 0.96 && height >= canvas.height * 0.96) {
      return canvas.toDataURL("image/png");
    }

    const cropped = document.createElement("canvas");
    cropped.width = width;
    cropped.height = height;
    const croppedCtx = cropped.getContext("2d");
    if (!croppedCtx) return canvas.toDataURL("image/png");
    croppedCtx.drawImage(canvas, sourceX, sourceY, width, height, 0, 0, width, height);
    return cropped.toDataURL("image/png");
  } catch {
    return null;
  }
}

async function trimConvertedPng(dataUrl: string): Promise<string | null> {
  if (typeof document === "undefined" || typeof Image === "undefined") return dataUrl;
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(image, 0, 0);
        resolve(cropCanvasToVisibleContent(canvas));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

type MetafileKind = "wmf" | "emf" | "unknown";

/** Detect the actual binary format instead of trying WMF and EMF blindly. */
export function detectMetafileKind(data: Uint8Array | ArrayBuffer): MetafileKind {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (u8.length >= 44) {
    const isEmf =
      u8[0] === 0x01 && u8[1] === 0x00 && u8[2] === 0x00 && u8[3] === 0x00 &&
      u8[40] === 0x20 && u8[41] === 0x45 && u8[42] === 0x4d && u8[43] === 0x46;
    if (isEmf) return "emf";
  }

  if (
    u8.length >= 22 &&
    u8[0] === 0xd7 && u8[1] === 0xcd && u8[2] === 0xc6 && u8[3] === 0x9a
  ) {
    return "wmf";
  }

  // Standard (non-placeable) WMF: type 1/2, 9-word header, version 0x0100/0x0300.
  if (u8.length >= 18) {
    const type = u8[0] | (u8[1] << 8);
    const headerWords = u8[2] | (u8[3] << 8);
    const version = u8[4] | (u8[5] << 8);
    if ((type === 1 || type === 2) && headerWords === 9 && (version === 0x0100 || version === 0x0300)) {
      return "wmf";
    }
  }

  return "unknown";
}

/**
 * The SheetJS-derived renderer handles MathType's legacy WMF coordinate
 * records more reliably. A fresh canvas is required for each header variant.
 */
function renderLegacyWmfToPng(u8: Uint8Array): string | null {
  if (typeof document === "undefined") return null;

  const stripped = stripAldusHeader(u8);
  const attempts = stripped.byteLength === u8.byteLength ? [u8] : [stripped, u8];
  for (const candidate of attempts) {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    try {
      WMF.draw_canvas(candidate, canvas);
      if (canvas.width > 0 && canvas.height > 0) {
        const png = cropCanvasToVisibleContent(canvas);
        if (png && png.length > 200) return png;
      }
    } catch {
      // Try the next header variant.
    }
  }
  return null;
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
    const kind = detectMetafileKind(u8);

    // MathType and Equation Editor usually store a legacy WMF preview. This
    // renderer honors their coordinate records and avoids clipped glyph arcs.
    if (kind !== "emf") {
      const legacyPng = renderLegacyWmfToPng(u8);
      if (legacyPng) return legacyPng;
    }

    const stripped = stripAldusHeader(u8);
    const variants = stripped.byteLength === u8.byteLength ? [u8] : [u8, stripped];

    if (kind !== "emf") {
      for (const candidate of variants) {
        try {
          const candidateBuffer = candidate.buffer.slice(candidate.byteOffset, candidate.byteOffset + candidate.byteLength);
          const pngUrl = await convertWmfToDataUrl(candidateBuffer, {
            maxWidth: 1200,
            maxHeight: 1000,
            dpiScale: 2,
          });
          if (pngUrl?.startsWith("data:image/png") && pngUrl.length > 200) {
            const trimmed = await trimConvertedPng(pngUrl);
            if (trimmed) return trimmed;
          }
        } catch {
          // Continue with the next header variant.
        }
      }
    }

    if (kind !== "wmf") {
      try {
        const emfUrl = await convertEmfToDataUrl(buffer, {
          maxWidth: 1200,
          maxHeight: 1000,
          dpiScale: 2,
        });
        if (emfUrl?.startsWith("data:image/png") && emfUrl.length > 200) {
          const trimmed = await trimConvertedPng(emfUrl);
          if (trimmed) return trimmed;
        }
      } catch {
        // Invalid/unsupported EMF.
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
    if (detectMetafileKind(u8) === "emf") return null;
    return renderLegacyWmfToPng(u8);
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
