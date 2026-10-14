import JSZip from "jszip";
import { getSourcePackage } from "./sourcePackageStore";

function safeName(value: string): string {
  return (value || "exam")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export async function exportSourceBundleForQuestions(
  questions: any[],
  bundleTitle = "EduTestPro_KHTN_Source_Package"
): Promise<{ saved: number; missing: string[] }> {
  const zip = new JSZip();
  const ids = Array.from(
    new Set(
      (questions || [])
        .map((q) => q?.originalSource?.fileId)
        .filter((v): v is string => Boolean(v))
    )
  );

  const missing: string[] = [];
  const sourceManifest: any[] = [];
  let saved = 0;

  for (const id of ids) {
    const record = await getSourcePackage(id);
    if (!record) {
      missing.push(id);
      continue;
    }
    const bytes = await record.blob.arrayBuffer();
    const fileName = `${id.slice(0, 18)}_${safeName(record.fileName) || "source.bin"}`;
    zip.file(`sources/${fileName}`, bytes);
    sourceManifest.push({
      id: record.id,
      fileName: record.fileName,
      storedAs: `sources/${fileName}`,
      mimeType: record.mimeType,
      size: record.size,
      sha256: record.sha256,
      createdAt: record.createdAt,
      metadata: record.metadata || {},
    });
    saved++;
  }

  const questionManifest = (questions || []).map((q) => ({
    id: q.id || q.originalId,
    questionIndex: q.questionIndex,
    content: q.content,
    originalSource: q.originalSource,
    preservation: q.preservation,
    formulaAssets: q.formulaAssets,
    imageAssetCount: q.imageAssets?.length || 0,
  }));

  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        schema: "edutest-pro-khtn-preservation-v3",
        exportedAt: new Date().toISOString(),
        title: bundleTitle,
        sourceFiles: sourceManifest,
        missingSourcePackageIds: missing,
        questions: questionManifest,
      },
      null,
      2
    )
  );

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName(bundleTitle) || "EduTestPro_KHTN"}_nguon-bao-toan.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }

  return { saved, missing };
}
