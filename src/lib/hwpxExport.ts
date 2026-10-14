import JSZip from "jszip";
import template from "./hwpxSurveyTemplate.json";
import { groupByAudience } from "./draftItems";
import { docxFileName } from "./docxExport";
import {
  AUDIENCES, AUDIENCE_LABELS, LIKERT_5_OPTIONS, LIKERT_3_OPTIONS, YES_NO_OPTIONS,
  type SelectedQuestion, type SurveyDraft
} from "./types";

/** XML 1.0 text only: user-entered questions must never become HWPX markup. */
function escapeXml(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function hwpxFileName(draft: SurveyDraft): string {
  return docxFileName(draft).replace(/\.docx$/, ".hwpx");
}

/** Native, editable HWPX. Formatting comes from a neutral Hancom-saved fixture. */
export async function buildSurveyHwpx(draft: SurveyDraft, items: SelectedQuestion[]): Promise<Buffer> {
  let paragraphId = 0;
  let tableId = 1000;
  const paragraph = (text: string, para = 7, char = 13, pageBreak = false, controls = "") => {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    return lines.map((line, index) => `<hp:p id="${++paragraphId}" paraPrIDRef="${para}" styleIDRef="0" pageBreak="${pageBreak && index === 0 ? 1 : 0}" columnBreak="0" merged="0"><hp:run charPrIDRef="${char}">${index === 0 ? controls : ""}<hp:t>${escapeXml(line)}</hp:t></hp:run></hp:p>`).join("");
  };
  const cell = (content: string, row: number, col: number, width: number, header = false) => (
    `<hp:tc name="" header="${header ? 1 : 0}" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="3"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${content}</hp:subList><hp:cellAddr colAddr="${col}" rowAddr="${row}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="${width}" height="1800"/><hp:cellMargin left="300" right="300" top="300" bottom="300"/></hp:tc>`
  ).replace('right="300" top="300"', `right="${col === 1 && !header ? 700 : 300}" top="300"`);
  const questionContent = (q: SelectedQuestion) => {
    let content = paragraph(q.editedQuestion || q.originalQuestion);
    if (q.responseType === "text") return content + paragraph("답변:") + paragraph("");
    const options = q.responseType === "likert_3" ? LIKERT_3_OPTIONS
      : q.responseType === "yes_no" ? YES_NO_OPTIONS : q.choices ?? [];
    // Keep the question's own selection limit, without adding conflicting instructions.
    const marker = q.responseType === "checklist" ? "□" : "○";
    content += paragraph(options.filter(option => option.trim()).map(option => `${marker} ${option}`).join("    "));
    return content;
  };
  const table = (questions: SelectedQuestion[], firstNumber: number, scale: boolean) => {
    const widths = scale ? [3000, 24100, 4500, 4500, 4500, 4500, 4500] : [3000, 46600];
    const labels = scale ? ["번호", "문항", ...LIKERT_5_OPTIONS] : ["번호", "문항 및 응답"];
    let rows = `<hp:tr>${labels.map((label, col) => cell(paragraph(label, 6, 14), 0, col, widths[col], true)).join("")}</hp:tr>`;
    questions.forEach((q, index) => {
      const row = index + 1;
      rows += `<hp:tr>${cell(paragraph(String(firstNumber + index), 6, 15), row, 0, widths[0])}${cell(scale ? paragraph(q.editedQuestion || q.originalQuestion) : questionContent(q), row, 1, widths[1])}${scale ? widths.slice(2).map((width, col) => cell(paragraph("", 6, 15), row, col + 2, width)).join("") : ""}</hp:tr>`;
    });
    const id = ++tableId;
    const control = `<hp:tbl id="${id}" zOrder="${id - 1001}" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="TABLE" repeatHeader="1" rowCnt="${questions.length + 1}" colCnt="${widths.length}" cellSpacing="0" borderFillIDRef="3" noAdjust="0"><hp:sz width="49600" widthRelTo="ABSOLUTE" height="${(questions.length + 1) * 2400}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="150" bottom="150"/><hp:inMargin left="300" right="300" top="300" bottom="300"/>${rows}</hp:tbl>`;
    return paragraph("", 8, 13, false, control);
  };
  const groups = groupByAudience(items);
  let body = "";
  let firstAudience = true;
  for (const audience of AUDIENCES) {
    const questions = groups[audience];
    if (!questions.length) continue;
    body += paragraph(`${draft.title} (${AUDIENCE_LABELS[audience]})`, 2, 12, !firstAudience,
      firstAudience ? template.sectionProperties : "");
    firstAudience = false;
    body += paragraph(draft.introByAudience[audience] ?? "", 3);
    body += paragraph(`${draft.surveyDate}\n${draft.schoolName}`, 4);
    body += paragraph("해당하는 응답 칸에 표시해 주세요. 선택형 문항은 질문에 안내된 개수에 맞게 선택해 주세요.", 3);
    for (let start = 0; start < questions.length;) {
      const scale = questions[start].responseType === "likert_5";
      let end = start + 1;
      while (end < questions.length && (questions[end].responseType === "likert_5") === scale) end++;
      body += table(questions.slice(start, end), start + 1, scale);
      start = end;
    }
    body += paragraph("※ 정성껏 응답해 주셔서 고맙습니다.", 3);
  }
  if (!body) body = paragraph(draft.title, 2, 12, false, template.sectionProperties) + paragraph("선택된 문항이 없습니다.");
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const zip = new JSZip();
  // HWPX requires an uncompressed mimetype as the first ZIP entry.
  zip.file("mimetype", "application/hwp+zip", { compression: "STORE" });
  for (const [name, contents] of Object.entries(template.files)) zip.file(name, contents);
  zip.file("Contents/header.xml", xml + template.header);
  zip.file("Contents/section0.xml", xml + template.sectionOpen + body + "</hs:sec>");
  zip.file("Contents/content.hpf", `${xml}<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" version="" unique-identifier="" id=""><opf:metadata><opf:title>${escapeXml(draft.title)}</opf:title><opf:language>ko</opf:language></opf:metadata><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>`);
  zip.file("Preview/PrvText.txt", draft.title);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

