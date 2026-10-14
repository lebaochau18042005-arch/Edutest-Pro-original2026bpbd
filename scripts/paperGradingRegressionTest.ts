import { gradeScannedPaper } from "../src/utils/paperGrading";
const rubric:any={id:"r",title:"T",subject:"X",grade:"12",maxScore:1,sourceType:"manual_text",createdAt:new Date().toISOString(),items:[{questionIndex:1,printedNumber:1,questionType:"multiple_choice",correctAnswer:"B",points:1}]};
const scan:any={examCode:"",part1:{1:"B"},part2:{},part3:{},studentName:"HS",studentClass:"12A1"};
const out=gradeScannedPaper(rubric,scan,{fileName:"test.png",mimeType:"image/png"});
if(out.totalScore!==1) throw new Error(`Expected 1, got ${out.totalScore}`);
console.log("PAPER_GRADING_REGRESSION_OK");
