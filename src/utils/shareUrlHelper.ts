import { ExamPackage, Question, ExamConfig } from "../types";
import { generateVariantsFromQuestions } from "./examHelpers";

interface SharedExamPayload {
  v: number; // version
  title: string;
  accessCode: string;
  config: ExamConfig;
  questions: Question[];
}

/**
 * Compresses an exam package into a compact Base64URL string using native CompressionStream (gzip)
 */
export async function compressExamForSharing(pkg: ExamPackage): Promise<string> {
  try {
    // Strip redundant large data if present to keep URL ultra lightweight
    const sanitizedQuestions = pkg.originalQuestions.map((q) => {
      const copy = { ...q };
      // Keep essential question fields, omit heavy base64 data to guarantee fast QR scanning
      const isShortUrl = copy.diagramUrl && (copy.diagramUrl.startsWith("http://") || copy.diagramUrl.startsWith("https://") || copy.diagramUrl.length < 500);
      return {
        id: copy.id,
        content: copy.content,
        options: copy.options,
        correctIndex: copy.correctIndex,
        part: copy.part || 1,
        questionType: copy.questionType || "multiple_choice",
        statements: copy.statements,
        shortAnswer: copy.shortAnswer,
        explanation: copy.explanation && copy.explanation.length > 300 ? copy.explanation.slice(0, 300) : copy.explanation,
        level: copy.level,
        chapter: copy.chapter,
        subject: copy.subject,
        grade: copy.grade,
        passageContent: copy.passageContent,
        groupId: copy.groupId,
        diagramUrl: isShortUrl ? copy.diagramUrl : undefined,
      };
    });

    const payload: SharedExamPayload = {
      v: 1,
      title: pkg.title,
      accessCode: pkg.accessCode,
      config: pkg.config,
      questions: sanitizedQuestions as Question[],
    };

    const json = JSON.stringify(payload);

    // Use native CompressionStream if available
    if (typeof CompressionStream !== "undefined") {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
      const res = new Response(stream);
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      
      // Convert to base64url
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    }

    // Fallback if CompressionStream not supported: encodeURIComponent + btoa
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
 * Decompresses a Base64URL string back into a full ExamPackage with generated variants
 */
export async function decompressExamFromSharing(base64url: string): Promise<ExamPackage | null> {
  try {
    if (!base64url) return null;

    let json = "";

    if (typeof DecompressionStream !== "undefined") {
      try {
        let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) base64 += "=";
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
        const res = new Response(stream);
        json = await res.text();
      } catch (e) {
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
    const payload: SharedExamPayload = JSON.parse(json);

    if (!payload.questions || !Array.isArray(payload.questions)) {
      return null;
    }

    // Reconstruct full ExamPackage with generated variants
    const config = payload.config || {
      subject: "Khảo thí",
      examPeriod: "Kiểm tra",
      duration: 45,
      maxScore: 10,
      examCodes: ["101", "102", "103", "104"],
      shuffleQuestions: true,
      shuffleOptions: true,
      allowReviewAfterSubmit: true,
      maxTabViolations: 3,
    };

    const variants = generateVariantsFromQuestions(payload.questions, config);

    const examPackage: ExamPackage = {
      id: `shared-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: payload.title || "Đề thi trực tuyến",
      config,
      originalQuestions: payload.questions,
      variants,
      createdAt: new Date().toISOString(),
      status: "published",
      accessCode: (payload.accessCode || "THPT2026").toUpperCase(),
    };

    return examPackage;
  } catch (err) {
    console.error("Error decompressing exam:", err);
    return null;
  }
}

/**
 * Builds the complete shareable URL
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
      const hostname = window.location.hostname;
      // If user is running on localhost or 127.0.0.1, phone scanning QR code cannot open localhost!
      // So we default to the local Wi-Fi IP (10.10.10.164:3000) for testing, or window.location.origin
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        origin = `http://10.10.10.164:${window.location.port || 3000}`;
      } else {
        origin = window.location.origin;
      }
    } else {
      origin = "https://edutest-pro-original2026bpbd.vercel.app";
    }
  }

  const simpleCodeLink = `${origin}/?code=${encodeURIComponent(pkg.accessCode)}&auto=1`;

  // Try self-contained compressed link
  const compressed = await compressExamForSharing(pkg);
  let directLink = simpleCodeLink;
  let isSelfContained = false;

  // Use query param ?exam=... which QR scanners & Zalo open 100% reliably
  if (compressed && compressed.length < 3800) {
    directLink = `${origin}/?exam=${compressed}`;
    isSelfContained = true;
  }

  // Use qrserver API for crisp 400x400 QR code
  const targetForQr = directLink.length < 2800 ? directLink : simpleCodeLink;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=15&format=png&data=${encodeURIComponent(targetForQr)}`;

  return {
    directLink,
    simpleCodeLink,
    qrCodeUrl,
    isSelfContained,
  };
}
