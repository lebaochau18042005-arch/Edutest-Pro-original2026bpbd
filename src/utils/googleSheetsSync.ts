import type { StudentSubmission } from "../types";

export async function syncSubmissionToGoogleSheetsWebhook(submission: StudentSubmission, webhookUrl: string): Promise<boolean> {
  if (!webhookUrl || !/^https?:\/\//i.test(webhookUrl)) return false;
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  if (!res.ok) throw new Error(`Google Sheets webhook HTTP ${res.status}`);
  return true;
}
