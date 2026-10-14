import fs from "fs";

const share = fs.readFileSync("src/utils/shareUrlHelper.ts", "utf8");
const studentRoom = fs.readFileSync("src/components/student/StudentExamRoom.tsx", "utf8");
const server = fs.readFileSync("server.ts", "utf8");
const failures: string[] = [];
if (/directLink\s*=\s*`[^`]*#exam=/.test(share)) failures.push("QR production vẫn nhúng #exam payload");
if (/gradeSubmission\s*\(/.test(studentRoom)) failures.push("StudentExamRoom vẫn tự chấm ở client");
for (const field of ["delete copy.correctIndex", "delete copy.shortAnswer", "answerKey: {}"]){ if (!server.includes(field)) failures.push(`Thiếu sanitize: ${field}`); }
if (!server.includes("EDUTEST_ADMIN_TOKEN")) failures.push("Thiếu khóa quản trị server");
if (!server.includes("FIREBASE_DATABASE_URL")) failures.push("Thiếu kho đề private phía server");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("SECURITY_REGRESSION_OK");
