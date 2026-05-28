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
  type SurveyDraft
} from "./types";

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

const KOREAN_RUN_DEFAULTS = {
  font: KOREAN_FONT,
  language: KOREAN_LANGUAGE
} as const;

function koreanRun(text: string, bold = false): TextRun {
  return new TextRun({ text, bold, ...KOREAN_RUN_DEFAULTS });
}

function koreanParagraph(options: IParagraphOptions): Paragraph {
  return new Paragraph({
    autoSpaceEastAsianText: true,
    ...options,
    run: { ...KOREAN_RUN_DEFAULTS, ...options.run }
  });
}

function textParagraph(text: string, bold = false): Paragraph {
  return koreanParagraph({
    children: [koreanRun(text, bold)],
    spacing: { after: 120 }
  });
}

function cell(children: Paragraph[], width: number): TableCell {
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
  const paragraphs = [
    textParagraph(
      question.indicator
        ? `【영역】 ${question.subarea} - ${question.indicator}`
        : `${question.area} / ${question.subarea}`,
      true
    ),
    textParagraph(question.editedQuestion || question.originalQuestion)
  ];

  if (question.responseType === "likert_5") {
    paragraphs.push(textParagraph(LIKERT_5_OPTIONS.map((option, index) => `${index + 1}. ${option}`).join("  ")));
  } else if (question.responseType === "likert_3") {
    paragraphs.push(textParagraph(LIKERT_3_OPTIONS.map((option, index) => `${index + 1}. ${option}`).join("  ")));
  } else if (question.responseType === "yes_no") {
    paragraphs.push(textParagraph(YES_NO_OPTIONS.map((option, index) => `${index + 1}. ${option}`).join("  ")));
  } else if (question.responseType === "checklist") {
    paragraphs.push(textParagraph("해당되는 항목을 모두 선택하세요."));
    paragraphs.push(textParagraph(YES_NO_OPTIONS.map((option) => `□ ${option}`).join("    ")));
  } else {
    paragraphs.push(textParagraph("답변:"));
    paragraphs.push(textParagraph("                                                                 "));
    paragraphs.push(textParagraph("                                                                 "));
  }

  return paragraphs;
}

function sectionForAudience(
  draft: SurveyDraft,
  audienceItems: SelectedQuestion[],
  audienceLabel: string
): FileChild[] {
  if (audienceItems.length === 0) {
    return [];
  }

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        cell([textParagraph("번호", true)], 10),
        cell([textParagraph("문항", true)], 90)
      ]
    }),
    ...audienceItems
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(
        (question, index) =>
          new TableRow({
            children: [
              cell(
                [
                  koreanParagraph({
                    alignment: AlignmentType.CENTER,
                    children: [koreanRun(String(index + 1))]
                  })
                ],
                10
              ),
              cell(questionParagraphs(question), 90)
            ]
          })
      )
  ];

  return [
    koreanParagraph({
      children: [koreanRun(`${draft.title} (${audienceLabel})`, true)],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 }
    }),
    textParagraph(draft.introByAudience[audienceItems[0].audience] ?? ""),
    koreanParagraph({
      alignment: AlignmentType.CENTER,
      children: [
        koreanRun(draft.surveyDate),
        koreanRun("\n"),
        koreanRun(draft.schoolName)
      ]
    }),
    koreanParagraph({ children: [koreanRun("")], spacing: { after: 160 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows
    }),
    koreanParagraph({
      children: [koreanRun("※ 정성껏 응답해 주셔서 고맙습니다.")],
      spacing: { before: 240, after: 360 }
    })
  ];
}

export async function buildSurveyDocx(draft: SurveyDraft): Promise<Buffer> {
  const children = AUDIENCES.flatMap((audience) =>
    sectionForAudience(draft, draft.itemsByAudience[audience] ?? [], AUDIENCE_LABELS[audience])
  );

  const document = new Document({
    styles: {
      default: {
        document: {
          run: KOREAN_RUN_DEFAULTS
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
        properties: {},
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
