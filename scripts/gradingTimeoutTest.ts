import assert from "node:assert/strict";
import { withGradingTimeout } from "../src/utils/gradingTimeout";

assert.equal(await withGradingTimeout(async () => "ok", 1000), "ok");
const error = new Error("API failure");
await assert.rejects(withGradingTimeout(async () => { throw error; }, 1000), e => e === error);
let signal: AbortSignal | undefined;
await assert.rejects(withGradingTimeout(s => {
  signal = s;
  return new Promise(() => {}); // Simulate an unresponsive transport.
}, 10), /AI phản hồi quá chậm/);
assert.equal(signal?.aborted, true);
let successSignal: AbortSignal | undefined;
await withGradingTimeout(async s => { successSignal = s; }, 10);
await new Promise(resolve => setTimeout(resolve, 25));
assert.equal(successSignal?.aborted, false);
console.log("Grading timeout checks passed.");
