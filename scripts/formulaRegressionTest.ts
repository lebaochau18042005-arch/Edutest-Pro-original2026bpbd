import assert from "node:assert/strict";
import { DOMParser as XmlDomParser } from "@xmldom/xmldom";
import JSZip from "jszip";
import katex from "katex";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MathTextRenderer } from "../src/components/FormattedQuestionContent";
import { splitRawTextIntoStatements as splitClientStatements } from "../src/utils/clientAI";
import { extractDocxDeep } from "../src/utils/docxDeepExtractor";
import { convertDocxHtmlToMarkdown } from "../src/utils/docxTableConverter";
import { splitRawTextIntoStatements as splitHelperStatements } from "../src/utils/examHelpers";
import { detectMetafileKind } from "../src/utils/wmfHelper";

const xmlProbe = new XmlDomParser().parseFromString("<root><child/></root>", "text/xml");
const elementPrototype = Object.getPrototypeOf(xmlProbe.documentElement);
if (!("children" in elementPrototype)) {
  Object.defineProperty(elementPrototype, "children", {
    configurable: true,
    get(this: Element) {
      return Array.from(this.childNodes).filter((node) => node.nodeType === 1);
    },
  });
}

class BrowserLikeDomParser {
  parseFromString(source: string, mimeType: string) {
    const isHtml = mimeType.toLowerCase().includes("html");
    const wrapped = isHtml ? `<html><body>${source}</body></html>` : source;
    const document = new XmlDomParser().parseFromString(wrapped, isHtml ? "text/xml" : mimeType);
    if (isHtml) {
      Object.defineProperty(document, "body", {
        configurable: true,
        value: document.getElementsByTagName("body")[0],
      });
    }
    return document;
  }
}

Object.assign(globalThis, {
  DOMParser: BrowserLikeDomParser,
  Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
});

function assertAllLatexIsRenderable(text: string) {
  const formulas = Array.from(text.matchAll(/\$([^$]+)\$/g), (match) => match[1]);
  assert.ok(formulas.length > 0, "expected at least one LaTeX formula");
  formulas.forEach((formula) => {
    katex.renderToString(formula, { throwOnError: true });
  });
}

function testMetafileDetection() {
  const placeableWmf = new Uint8Array(22);
  placeableWmf.set([0xd7, 0xcd, 0xc6, 0x9a]);
  assert.equal(detectMetafileKind(placeableWmf), "wmf");

  const standardWmf = new Uint8Array(18);
  standardWmf.set([0x01, 0x00, 0x09, 0x00, 0x00, 0x03]);
  assert.equal(detectMetafileKind(standardWmf), "wmf");

  const emf = new Uint8Array(44);
  emf.set([0x01, 0x00, 0x00, 0x00]);
  emf.set([0x20, 0x45, 0x4d, 0x46], 40);
  assert.equal(detectMetafileKind(emf), "emf");
  assert.equal(detectMetafileKind(new Uint8Array([1, 2, 3])), "unknown");
}

function testMammothHtmlFallback() {
  const result = convertDocxHtmlToMarkdown(
    "<p><strong>Cho hàm số</strong> H<sub>2</sub>SO<sub>4</sub>, 10<sup>-3</sup> mol và m/s<sup>2</sup>.</p>"
  );
  assert.match(result.markdown, /\*\*Cho hàm số\*\*/);
  assert.match(result.markdown, /H\$\{\}_\{2\}\$SO\$\{\}_\{4\}\$/);
  assert.match(result.markdown, /10\$\{\}\^\{-3\}\$/);
  assert.match(result.markdown, /m\/s\$\{\}\^\{2\}\$/);
  assertAllLatexIsRenderable(result.markdown);
}

function testQuestionRenderer() {
  const markup = renderToStaticMarkup(
    React.createElement(MathTextRenderer, { text: "**Cho hàm số** H${}_{2}$O và 10${}^{-3}$ mol" })
  );
  assert.match(markup, /<strong>Cho hàm số<\/strong>/);
  assert.match(markup, /class="katex"/);
  assert.doesNotMatch(markup, /\*\*/);
}

function testScientificCasePreservation() {
  const source = [
    "a) f(x) liên tục trên R.",
    "b) pH của dung dịch bằng 7.",
    "c) DNA mang thông tin di truyền.",
    "d) mRNA tham gia tổng hợp protein.",
  ].join("\n");

  for (const split of [splitClientStatements, splitHelperStatements]) {
    const statements = split(source);
    assert.equal(statements[0]?.text, "f(x) liên tục trên R.");
    assert.equal(statements[1]?.text, "pH của dung dịch bằng 7.");
    assert.equal(statements[2]?.text, "DNA mang thông tin di truyền.");
    assert.equal(statements[3]?.text, "mRNA tham gia tổng hợp protein.");
  }
}

async function testDeepOmmlAndScientificRuns() {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
 <w:body>
  <w:p>
   <w:r><w:rPr><w:b/></w:rPr><w:t>Cho hàm số </w:t></w:r>
   <m:oMath><m:f><m:num><m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup></m:num><m:den><m:r><m:t>1−x</m:t></m:r></m:den></m:f></m:oMath>
   <w:r><w:t> với v</w:t></w:r><m:oMath><m:r><m:t>≤c</m:t></m:r></m:oMath>
   <w:r><w:t>, H</w:t></w:r><w:r><w:rPr><w:vertAlign w:val="subscript"/></w:rPr><w:t>2</w:t></w:r>
   <w:r><w:t>O và 10</w:t></w:r><w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>-3</w:t></w:r><w:r><w:t> mol.</w:t></w:r>
  </w:p>
 </w:body>
</w:document>`;

  const zip = new JSZip();
  zip.file("word/document.xml", documentXml);
  const arrayBuffer = await zip.generateAsync({ type: "arraybuffer" });
  const result = await extractDocxDeep(arrayBuffer);

  assert.match(result.markdown, /\\frac\{\{x\}\^\{2\}\}\{1-x\}/);
  assert.match(result.markdown, /\\le c/);
  assert.match(result.markdown, /H\$\{\}_\{2\}\$O/);
  assert.match(result.markdown, /10\$\{\}\^\{-3\}\$/);
  assertAllLatexIsRenderable(result.markdown);
}

testMetafileDetection();
testMammothHtmlFallback();
testQuestionRenderer();
testScientificCasePreservation();
await testDeepOmmlAndScientificRuns();
console.log("Formula regression tests passed.");

