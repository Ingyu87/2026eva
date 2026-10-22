import {
  AlignmentType,
  BorderStyle,
  Document,
  FileChild,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TableLayoutType,
  VerticalAlign,
  TextRun,
  WidthType,
  type IFontAttributesProperties,
  type IParagraphOptions
} from "docx";
import {
  AUDIENCES,
  AUDIENCE_LABELS,
  LIKERT_3_OPTIONS,
  LIKERT_5_OPTIONS,
  YES_NO_OPTIONS,
  type SelectedQuestion,
  type SurveyDraft,
  surveyQuestionText
} from "./types";
import { groupByAudience } from "./draftItems";

/** Word에서 한글이 붙어 보이지 않도록 동아시아 폰트·언어를 명시한다. */
const KOREAN_FONT: IFontAttributesProperties = {
  ascii: "Malgun Gothic",
  hAnsi: "Malgun Gothic",
  eastAsia: "맑은 고딕",
  cs: "Malgun Gothic"
};

const KOREAN_LANGUAGE = {
  value: "ko-KR",
  eastAsia: "ko-KR"
} as const;

export const KOREAN_RUN_DEFAULTS = {
  font: KOREAN_FONT,
  language: KOREAN_LANGUAGE
} as const;

export function koreanRun(text: string, bold = false): TextRun {
  return new TextRun({ text, bold, ...KOREAN_RUN_DEFAULTS });
}

export function koreanParagraph(options: IParagraphOptions): Paragraph {
  return new Paragraph({
    autoSpaceEastAsianText: true,
    ...options,
    run: { ...KOREAN_RUN_DEFAULTS, ...options.run }
  });
}

export function textParagraph(text: string, bold = false): Paragraph {
  return koreanParagraph({
    children: text.split(/\r\n|\r|\n/).map((line, index) =>
      new TextRun({ text: line, bold, ...KOREAN_RUN_DEFAULTS, ...(index ? { break: 1 } : {}) })
    ),
    spacing: { after: 120 }
  });
}

export function cell(children: Paragraph[], width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "999999" }
    },
    children
  });
}

function questionParagraphs(question: SelectedQuestion): Paragraph[] {
  const paragraphs = [textParagraph(surveyQuestionText(question))];

  if (question.responseType === "likert_5") {
    paragraphs.push(textParagraph(LIKERT_5_OPTIONS.map((option, index) => `${index + 1}. ${option}`).join("  ")));
  } else if (question.responseType === "likert_3") {
    paragraphs.push(textParagraph(LIKERT_3_OPTIONS.map((option, index) => `${index + 1}. ${option}`).join("  ")));
  } else if (question.responseType === "yes_no") {
    paragraphs.push(textParagraph(YES_NO_OPTIONS.map((option, index) => `${index + 1}. ${option}`).join("  ")));
  } else if (question.responseType === "choice_single" || question.responseType === "checklist") {
    const options = (question.choices ?? []).map((choice) => choice.trim()).filter(Boolean);
    const multi = question.responseType === "checklist";
    // 선택 개수는 문항 본문을 따른다. 일괄 안내는 '2개 선택' 등과 충돌한다.
    paragraphs.push(
      textParagraph(options.map((option) => `${multi ? "□" : "○"} ${option}`).join("    "))
    );
  } else {
    paragraphs.push(textParagraph("답변:"));
    paragraphs.push(textParagraph("                                                                 "));
  }

  return paragraphs;
}

function sectionForAudience(
  draft: SurveyDraft,
  audienceItems: SelectedQuestion[],
  audienceLabel: string,
  pageBreakBefore: boolean
): FileChild[] {
  if (audienceItems.length === 0) {
    return [];
  }

  // Explicit grid and cell widths prevent Word/LibreOffice from making equal columns.
  const width = 9920;
  const numberWidth = 600;
  const scaleWidth = 900;
  const surveyCell = (paragraphs: Paragraph[], size: number) => new TableCell({
    width: { size, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    children: paragraphs
  });
  const centered = (text: string, bold = false) => koreanParagraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold, ...KOREAN_RUN_DEFAULTS, size: 18 })],
    spacing: { after: 0 }
  });
  const tables: FileChild[] = [];
  const ordered = audienceItems.slice().sort((a, b) => a.order - b.order);
  let start = 0;
  while (start < ordered.length) {
    const scale = ordered[start].responseType === "likert_5";
    let end = start + 1;
    while (end < ordered.length && (ordered[end].responseType === "likert_5") === scale) end++;
    const widths = scale
      ? [numberWidth, width - numberWidth - 5 * scaleWidth, ...Array(5).fill(scaleWidth)]
      : [numberWidth, width - numberWidth];
    const headings = scale ? ["번호", "문항", ...LIKERT_5_OPTIONS] : ["번호", "문항 및 응답"];
    const rows = [new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: headings.map((heading, index) => surveyCell([centered(heading, true)], widths[index]))
    })];
    for (let index = start; index < end; index++) {
      const question = ordered[index];
      rows.push(new TableRow({
        cantSplit: true,
        children: [
          surveyCell([centered(String(index + 1))], widths[0]),
          surveyCell(scale ? [textParagraph(surveyQuestionText(question))] : questionParagraphs(question), widths[1]),
          ...(scale ? LIKERT_5_OPTIONS.map(() => surveyCell([centered("")], scaleWidth)) : [])
        ]
      }));
    }
    tables.push(new Table({
      width: { size: width, type: WidthType.DXA },
      columnWidths: widths,
      layout: TableLayoutType.FIXED,
      rows
    }));
    if (end < ordered.length) tables.push(koreanParagraph({ children: [], spacing: { after: 80 } }));
    start = end;
  }

  return [
    koreanParagraph({
      children: [koreanRun(`${draft.title} (${audienceLabel})`, true)],
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 }
    }),
    textParagraph(draft.introByAudience[audienceItems[0].audience] ?? ""),
    koreanParagraph({
      alignment: AlignmentType.CENTER,
      children: [
        koreanRun(draft.surveyDate),
        new TextRun({ text: draft.schoolName, break: 1, ...KOREAN_RUN_DEFAULTS })
      ]
    }),
    koreanParagraph({ children: [koreanRun("")], spacing: { after: 160 } }),
    ...tables,
    koreanParagraph({
      children: [koreanRun("※ 정성껏 응답해 주셔서 고맙습니다.")],
      spacing: { before: 240, after: 360 }
    })
  ];
}

export async function buildSurveyDocx(
  draft: SurveyDraft,
  items: SelectedQuestion[]
): Promise<Buffer> {
  const byAudience = groupByAudience(items);
  const children = AUDIENCES.filter(audience => byAudience[audience].length > 0).flatMap((audience, index) =>
    sectionForAudience(draft, byAudience[audience], AUDIENCE_LABELS[audience], index > 0)
  );

  const document = new Document({
    styles: {
      default: {
        document: {
          run: { ...KOREAN_RUN_DEFAULTS, size: 20 },
          paragraph: { spacing: { line: 264, after: 80 } }
        },
        heading1: {
          run: KOREAN_RUN_DEFAULTS
        }
      }
    },
    compatibility: {
      useFELayout: true
    },
    sections: [
      {
        properties: { page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1000, bottom: 1000, left: 993, right: 993 }
        } },
        children:
          children.length > 0
            ? children
            : [
                koreanParagraph({
                  children: [koreanRun(draft.title, true)],
                  heading: HeadingLevel.HEADING_1,
                  alignment: AlignmentType.CENTER
                }),
                textParagraph("선택된 문항이 없습니다.")
              ]
      }
    ]
  });

  return Packer.toBuffer(document);
}

export function docxFileName(draft: SurveyDraft): string {
  const safeSchoolName = draft.schoolName.replace(/[<>:"/\\|?*\s]+/g, "_");
  const safeTitle = draft.title.replace(/[<>:"/\\|?*\s]+/g, "_");
  return `${safeTitle}_${safeSchoolName}.docx`;
}
