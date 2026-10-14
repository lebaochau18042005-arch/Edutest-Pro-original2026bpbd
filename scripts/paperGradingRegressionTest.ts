import assert from "node:assert/strict";
import { gradeScannedPaper, recognizeAndGradePaper } from "../src/utils/paperGrading";
import { validateRubricSettings } from "../src/utils/rubricSettings";
import type { ExamRubric, RubricItem } from "../src/types";
const make = (items: RubricItem[], weight = 1): ExamRubric => ({ id: "test", title: "Test", subject: "", grade: "", sourceType: "manual_text", createdAt: "", examCode: "9001", items, maxScore: items.reduce((s,i)=>s+i.points,0), gradeWeight: weight });
const mc: RubricItem = { questionIndex: 1, printedNumber: 3, questionType: "multiple_choice", correctAnswer: "C", points: 2 };
const tf: RubricItem = { questionIndex: 2, printedNumber: 1, questionType: "true_false", correctAnswer: "ĐSĐS", points: 4 };
const scan = { examCode: "9001", part1: {3: "A"}, part2: {1: {a: "Đ", b: "S", c: "S", d: "Đ"}}, part3: {} };
const grade = (rubric: ExamRubric, data = scan) => gradeScannedPaper(rubric,data,{fileName:"test.jpg"});
assert.equal(grade(make([mc])).totalScore,0);
assert.equal(grade(make([{...mc,correctAnswer:"A"}])).totalScore,2);
assert.equal(grade(make([mc])).details[0].studentAnswer,"A");
assert.equal(grade(make([mc,tf])).totalScore,1);
assert.equal(grade(make([mc,{...tf,trueFalseScoring:"linear"}])).totalScore,2);
assert.equal(grade(make([mc,{...tf,trueFalseScoring:"all_or_nothing"}])).totalScore,0);
assert.equal(grade(make([mc,tf],3)).totalScore,1);
assert.equal(grade(make([mc,tf],3)).gradeWeight,3);
for (const [answer, expected] of [["SĐSĐ",0],["ĐSĐĐ",2],["ĐSĐS",4]] as const) {
 const values=Object.fromEntries([..."abcd"].map((k,i)=>[k,answer[i]]));
 assert.equal(grade(make([tf]),{...scan,part2:{1:values as any}}).totalScore,expected);
}
assert.ok(validateRubricSettings({...make([mc]),maxScore:10}).length);
assert.ok(validateRubricSettings(make([mc,{...mc,questionIndex:2}])).length);
assert.ok(validateRubricSettings(make([{...tf,correctAnswer:"ĐS"}])).length);
assert.throws(()=>grade(make([mc]),{...scan,examCode:"9002"}),/Mã đề/);
const short: RubricItem={questionIndex:3,printedNumber:1,questionType:"short_answer",correctAnswer:"-2,5",points:1};
assert.equal(gradeScannedPaper(make([short]),{...scan,part3:{1:"-2.5"}},{fileName:"test"}).totalScore,1);
let calls=0;
const recognized = await recognizeAndGradePaper({data:"image",mimeType:"image/jpeg"},make([{...mc,correctAnswer:"C: SECRET_TEACHER_KEY"}]),async(contents)=>{
 calls++;
 assert.ok(!JSON.stringify(contents).includes("SECRET_TEACHER_KEY"));
 return JSON.stringify({examCode:"9001",part1:[{question:3,selected:"A"}],part2:[],part3:[]});
});
assert.equal(calls,1); assert.equal(recognized.totalScore,0);
await assert.rejects(recognizeAndGradePaper({data:"image",mimeType:"image/jpeg"},make([mc]),async()=>"bad json"),/không hợp lệ/);
await assert.rejects(recognizeAndGradePaper({data:"image",mimeType:"image/jpeg"},make([mc]),async()=>JSON.stringify({part1:[{question:3,selected:"A"},{question:3,selected:"C"}],part2:[],part3:[]})),/trùng/);
console.log("Passed: configurable scoring, weights, printed numbers, validation, wrong answers, isolated OCR and invalid scans.");

const mistakenOCR = async () => JSON.stringify({examCode:"9001",part1:[{question:3,selected:"C"}],part2:[],part3:[]});
let reviewed = false;
const corrected = await recognizeAndGradePaper({data:"image",mimeType:"image/jpeg"},make([mc]),mistakenOCR,"standard",async scan => {
  reviewed = true;
  assert.equal(scan.part1[3],"C");
  return {...scan,part1:{3:"A"}};
});
assert.ok(reviewed);
assert.equal(corrected.details[0].studentAnswer,"A");
assert.equal(corrected.totalScore,0);
assert.match(corrected.teacherNotes!,/đã duyệt/);
await assert.rejects(recognizeAndGradePaper({data:"image",mimeType:"image/jpeg"},make([mc]),mistakenOCR,"standard",async () => { throw new Error("Dừng duyệt"); }),/Dừng duyệt/);
const unreviewed = await recognizeAndGradePaper({data:"image",mimeType:"image/jpeg"},make([mc]),mistakenOCR);
assert.match(unreviewed.summaryEvaluation,/CHƯA DUYỆT/);
console.log("Passed: correction before grading, cancellation without result, unreviewed results marked provisional.");
