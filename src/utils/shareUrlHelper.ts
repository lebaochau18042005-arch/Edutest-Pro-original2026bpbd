import { ExamPackage, Question, ExamConfig, TrueFalseStatement } from "../types";
import { generateVariantsFromQuestions } from "./examHelpers";

// Legacy v1 schema
interface SharedExamPayloadV1 {
  v: 1;
  title: string;
  accessCode: string;
  config: ExamConfig;
  questions: Question[];
}

// Ultra-compact v2 schema (60-80% smaller payload so 40 questions easily fit in QR code)
interface MinifiedExamPayloadV2 {
  v: 2;
  t: string; // exam title
  c: string; // accessCode
  cfg: {
    s: string; // subject
    g: string; // grade
    d: number; // duration
    m?: number; // maxScore
    v?: number; // maxTabViolations
    k?: string[]; // examCodes
  };
  q: Array<{
    p: number; // part (1: 4-choice, 2: true/false, 3: short answer)
    c: string; // content
    o?: string[]; // options (part 1)
    a?: number; // correctIndex (part 1)
    s?: Array<[string, boolean]>; // statements: [text, value] (part 2)
    k?: string; // shortAnswer (part 3)
    u?: string; // diagramUrl if any
    g?: string; // passageContent if any
  }>;
}

/**
 * Converts a Uint8Array to a URL-safe Base64 string without call stack limits
 */
function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Converts a URL-safe Base64 string to a Uint8Array
 */
function base64UrlToUint8Array(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compresses an exam package into a compact Base64URL string using native CompressionStream (gzip).
 * Uses minified format (v: 2) to ensure 30-50 question exams easily fit within standard QR codes (< 1500 chars).
 */
export async function compressExamForSharing(pkg: ExamPackage): Promise<string> {
  try {
    const minifiedQuestions = pkg.originalQuestions.map((q) => {
      const part = q.part || 1;
      const item: any = {
        p: part,
        c: q.content,
      };

      if (part === 1 || q.questionType === "multiple_choice") {
        item.o = q.options || [];
        item.a = q.correctIndex ?? 0;
      } else if (part === 2 || q.questionType === "true_false") {
        if (q.statements && Array.isArray(q.statements)) {
          item.s = q.statements.map((st) => [st.text, Boolean(st.correctValue)]);
        }
      } else if (part === 3 || q.questionType === "short_answer") {
        item.k = q.shortAnswer || (q.acceptableAnswers && q.acceptableAnswers[0]) || "";
      }

      if (q.passageContent) {
        item.g = q.passageContent;
      }
      // Include diagramUrl only if it is short or hosted (omitting giant raw base64 data to keep QR ultra-scannable)
      if (
        q.diagramUrl &&
        (q.diagramUrl.startsWith("http://") ||
          q.diagramUrl.startsWith("https://") ||
          q.diagramUrl.length < 350)
      ) {
        item.u = q.diagramUrl;
      }

      return item;
    });

    const payload: MinifiedExamPayloadV2 = {
      v: 2,
      t: pkg.title,
      c: (pkg.accessCode || "THPT2026").toUpperCase(),
      cfg: {
        s: pkg.config?.subject || "Khảo thí",
        g: pkg.config?.grade || "Khối 12",
        d: pkg.config?.duration || 45,
        m: pkg.config?.maxScore || 10,
        v: pkg.config?.maxTabViolations || 3,
        k: pkg.config?.examCodes || ["101", "102", "103", "104"],
      },
      q: minifiedQuestions,
    };

    const json = JSON.stringify(payload);

    // Native gzip compression via CompressionStream
    if (typeof CompressionStream !== "undefined") {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
      const res = new Response(stream);
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      return uint8ArrayToBase64Url(bytes);
    }

    // Fallback if CompressionStream not available
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  } catch (err) {
    console.error("Error compressing exam:", err);
    return "";
  }
}

/**
 * Decompresses a Base64URL string back into a full ExamPackage with generated variants.
 * Supports both v: 2 (ultra-compact minified) and legacy v: 1.
 */
export async function decompressExamFromSharing(base64url: string): Promise<ExamPackage | null> {
  try {
    if (!base64url || typeof base64url !== "string") return null;

    let json = "";

    if (typeof DecompressionStream !== "undefined") {
      try {
        const bytes = base64UrlToUint8Array(base64url);
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
        const res = new Response(stream);
        json = await res.text();
      } catch {
        // Fallback standard base64 decoding
        let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) base64 += "=";
        json = decodeURIComponent(escape(atob(base64)));
      }
    } else {
      let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      json = decodeURIComponent(escape(atob(base64)));
    }

    if (!json) return null;
    const payload: any = JSON.parse(json);

    // FORMAT V2: Ultra-compact minified
    if (payload.v === 2) {
      const questions: Question[] = (payload.q || []).map((item: any, idx: number) => {
        const part = (item.p || 1) as 1 | 2 | 3;
        const qType = part === 1 ? "multiple_choice" : part === 2 ? "true_false" : "short_answer";

        let statements: TrueFalseStatement[] | undefined = undefined;
        if (part === 2 && Array.isArray(item.s)) {
          const labels = ["a", "b", "c", "d"];
          statements = item.s.map((st: [string, boolean], sIdx: number) => ({
            id: labels[sIdx] || String(sIdx),
            label: `${labels[sIdx] || sIdx})`,
            text: st[0] || "",
            correctValue: Boolean(st[1]),
          }));
        }

        return {
          id: `q_${Date.now()}_${idx + 1}`,
          subject: payload.cfg?.s || "Khảo thí",
          grade: payload.cfg?.g || "Khối 12",
          level: "Thông hiểu",
          part,
          questionType: qType,
          content: item.c || "",
          options: item.o || [],
          correctIndex: item.a ?? 0,
          statements,
          shortAnswer: item.k,
          passageContent: item.g,
          diagramUrl: item.u,
        };
      });

      const config: ExamConfig = {
        department: "BỘ GIÁO DỤC VÀ ĐÀO TẠO",
        school: "TRƯỜNG THPT CHUYÊN LÊ HỒNG PHONG",
        examPeriod: "Kiểm tra định kỳ",
        subject: payload.cfg?.s || "Khảo thí",
        grade: payload.cfg?.g || "Khối 12",
        duration: Number(payload.cfg?.d) || 45,
        originalExamCode: "101",
        examCodes:
          payload.cfg?.k && payload.cfg.k.length > 0
            ? payload.cfg.k
            : ["101", "102", "103", "104"],
        isOriginalKept: false,
        maxScore: Number(payload.cfg?.m) || 10,
        shuffleQuestions: true,
        shuffleOptions: true,
        allowReviewAfterSubmit: true,
        maxTabViolations: Number(payload.cfg?.v) || 3,
      };

      const variants = generateVariantsFromQuestions(questions, config);

      return {
        id: `exam-${Date.now()}`,
        title: payload.t || "Đề thi trực tuyến",
        config,
        originalQuestions: questions,
        variants,
        createdAt: new Date().toISOString(),
        status: "published",
        accessCode: (payload.c || "THPT2026").toUpperCase(),
      };
    }

    // FORMAT V1: Legacy full payload
    if (payload.questions && Array.isArray(payload.questions)) {
      const config: ExamConfig = {
        department: payload.config?.department || "BỘ GIÁO DỤC VÀ ĐÀO TẠO",
        school: payload.config?.school || "TRƯỜNG THPT CHUYÊN LÊ HỒNG PHONG",
        examPeriod: payload.config?.examPeriod || "Kiểm tra định kỳ",
        subject: payload.config?.subject || "Khảo thí",
        grade: payload.config?.grade || "Khối 12",
        duration: payload.config?.duration || 45,
        originalExamCode: payload.config?.originalExamCode || "101",
        examCodes: payload.config?.examCodes || ["101", "102", "103", "104"],
        isOriginalKept: payload.config?.isOriginalKept ?? false,
        maxScore: payload.config?.maxScore || 10,
        shuffleQuestions: payload.config?.shuffleQuestions ?? true,
        shuffleOptions: payload.config?.shuffleOptions ?? true,
        allowReviewAfterSubmit: payload.config?.allowReviewAfterSubmit ?? true,
        maxTabViolations: payload.config?.maxTabViolations || 3,
        ...payload.config,
      };

      const variants = generateVariantsFromQuestions(payload.questions, config);

      return {
        id: `exam-shared-${Date.now()}`,
        title: payload.title || "Đề thi trực tuyến",
        config,
        originalQuestions: payload.questions,
        variants,
        createdAt: new Date().toISOString(),
        status: "published",
        accessCode: (payload.accessCode || "THPT2026").toUpperCase(),
      };
    }

    return null;
  } catch (err) {
    console.error("Error decompressing exam:", err);
    return null;
  }
}

/**
 * Builds the complete shareable URL and QR code for an exam package.
 * Optimized with Cloud Database integration so QR code is ultra-clean, short, and 100% scannable.
 */
export async function buildExamShareLinks(
  pkg: ExamPackage,
  customOrigin?: string
): Promise<{
  directLink: string;
  simpleCodeLink: string;
  qrCodeUrl: string;
  isSelfContained: boolean;
}> {
  let origin = customOrigin;
  if (!origin) {
    if (typeof window !== "undefined") {
      origin = window.location.origin;
    } else {
      origin = "https://edutest-pro-original2026bpbd.vercel.app";
    }
  }

  // Remove trailing slash
  origin = origin.replace(/\/+$/, "");

  const cleanCode = (pkg.accessCode || "THPT2026").trim().toUpperCase();
  const simpleCodeLink = `${origin}/?code=${encodeURIComponent(cleanCode)}&auto=1`;

  // Compress exam package (v2 schema)
  const compressed = await compressExamForSharing(pkg);
  let directLink = simpleCodeLink;
  let isSelfContained = false;

  // Ultra-compact v2 payload: if compressed string is under 3200 chars, it is 100% self-contained
  if (compressed && compressed.length < 3200) {
    directLink = `${origin}/?code=${encodeURIComponent(cleanCode)}&exam=${compressed}&auto=1`;
    isSelfContained = true;
  }

  // For the QR code: Use self-contained directLink so every phone camera / Zalo instantly opens the exam
  const targetForQr = isSelfContained ? directLink : simpleCodeLink;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&margin=10&ecc=L&format=png&data=${encodeURIComponent(targetForQr)}`;

  return {
    directLink,
    simpleCodeLink,
    qrCodeUrl,
    isSelfContained,
  };
}
