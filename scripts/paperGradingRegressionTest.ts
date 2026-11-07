import { gradeScannedPaper } from "../src/utils/paperGrading";

const rubric: any = {
  id: "r-regression",
  title: "Regression 3 phần",
  subject: "Địa lí",
  grade: "12",
  maxScore: 3,
  sourceType: "manual_text",
  createdAt: new Date().toISOString(),
  items: [
    {
      questionIndex: 1,
      printedNumber: 1,
      questionType: "multiple_choice",
      correctAnswer: "B",
      points: 1,
    },
    {
      questionIndex: 2,
      printedNumber: 1,
      questionType: "true_false",
      correctAnswer: "a: Đúng | b: Sai | c: Đúng | d: Sai",
      points: 1,
    },
    {
      questionIndex: 3,
      printedNumber: 1,
      questionType: "short_answer",
      correctAnswer: "5",
      points: 1,
    },
  ],
};

const scan: any = {
  examCode: "",
  part1: { 1: "B" },
  part2: { 1: { a: "Đ", b: "S", c: "Đ", d: "S" } },
  part3: { 1: "5" },
  studentName: "HS",
  studentClass: "12A1",
};

const out = gradeScannedPaper(
  rubric,
  scan,
  { fileName: "test.png", mimeType: "image/png" }
);

const assertEqual = (label: string, actual: unknown, expected: unknown) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
};

assertEqual("part1Score", out.part1Score, 1);
assertEqual("part2Score", out.part2Score, 1);
assertEqual("part3Score", out.part3Score, 1);
assertEqual("objectiveScore", out.objectiveScore, 3);
assertEqual("totalScore", out.totalScore, 3);

const summed = Number(
  (
    Number(out.part1Score || 0) +
    Number(out.part2Score || 0) +
    Number(out.part3Score || 0) +
    Number(out.essayScore || 0)
  ).toFixed(2)
);
assertEqual("total equals sum of parts", out.totalScore, summed);

console.log("PAPER_GRADING_REGRESSION_OK", {
  part1Score: out.part1Score,
  part2Score: out.part2Score,
  part3Score: out.part3Score,
  objectiveScore: out.objectiveScore,
  totalScore: out.totalScore,
});
