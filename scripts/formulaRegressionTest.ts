import { normalizeExamQuestions3Parts } from "../src/utils/examHelpers";
const q:any={id:"q",content:"Cho x=1",subject:"Toán",grade:"12",level:"Nhận biết",part:1,questionType:"multiple_choice",options:["1","2"]};
const out:any=normalizeExamQuestions3Parts([q])[0];
if(out.options.length!==2) throw new Error("Normalizer đã tự bịa thêm phương án");
console.log("FORMULA_PRESERVATION_REGRESSION_OK");
