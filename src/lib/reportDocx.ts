/**
 * 학교평가서 DOCX (spec.md 7.3, 가이드북 60~61쪽 서식3-1·3-2).
 *
 * 2026-11 제공된 공식 HWP의 항목·순서를 기준으로 편집 가능한 DOCX를 생성합니다.
 *
 * 제출용(submit)에는 문항별 점수를 넣지 않습니다. 가이드북 p.51·p.60:
 * "평가문항별 점수는 학교 자체 보관하며 영역별 평균점수 결과만 학교평가서에 작성".
 */

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TableLayoutType,
  TextRun,
  WidthType,
  type FileChild
} from "docx";
import { cell, koreanParagraph, koreanRun, textParagraph, KOREAN_RUN_DEFAULTS } from "./docxExport";
import { AREAS } from "./evaluationFramework";
import { roundToOneDecimal } from "./scoring";
import {

  AUDIENCE_SHORT_LABELS,
  type AiFinding,
  type AiFindingCategory,
  type Audience,
  type Grade4,
  type QuestionStat,
  type SelectedQuestion,
  type SurveyDraft,
  type SurveyResult
} from "./types";

const AUDIENCES: Audience[] = ["student", "parent", "teacher", "staff"];

const GRADE4_ORDER: Grade4[] = ["매우 우수", "우수", "보통", "미흡"];
const FINDING_CATEGORIES: AiFindingCategory[] = ["우수한 점", "개선할 점", "컨설팅장학 등 교육청 지원이 필요한 부분"];

function headerCell(text: string, width: number, columnSpan = 1, rowSpan = 1): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    columnSpan,
    rowSpan,
    shading: { type: ShadingType.SOLID, color: "F2F3FD", fill: "F2F3FD" },
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    children: [koreanParagraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: 0, line: 220 }, children: [new TextRun({ text, bold: true, ...KOREAN_RUN_DEFAULTS, size: 16 })] })]
  });
}

function centerCell(text: string, width: number): TableCell {
  return cell([koreanParagraph({ alignment: AlignmentType.CENTER, children: [koreanRun(text)] })], width);
}

function textCell(text: string, width: number): TableCell {
  return cell(text.split('\n').map(line => koreanParagraph({ spacing: { after: 0, line: 240 }, children: [new TextRun({ text: line, ...KOREAN_RUN_DEFAULTS, size: 20 })] })), width);
}

function groupByGroupId(items: SelectedQuestion[]): SelectedQuestion[][] {
  const order: string[] = [];
  const groups = new Map<string, SelectedQuestion[]>();
  for (const item of items) {
    const key = JSON.stringify([item.groupId || item.id, item.area, item.subarea, item.indicator, (item.editedQuestion || item.originalQuestion) === item.originalQuestion ? "original" : item.editedQuestion]);
    if (!groups.has(key)) {
      order.push(key);
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }
  return order.map((id) => groups.get(id)!);
}

function title(text: string): Paragraph {
  return koreanParagraph({
    children: [koreanRun(text, true)],
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 }
  });
}

function schoolNameLine(draft: SurveyDraft): Paragraph {
  return koreanParagraph({
    alignment: AlignmentType.RIGHT,
    children: [koreanRun(draft.schoolName)],
    spacing: { after: 200 }
  });
}

/** 서식3-1의 표1: 영역별 평가 결과. 영역×주체 조합마다 4단계 중 하나에 "✔" 표시. */
function areaResultTable(result: SurveyResult): Table {
  const gradeByAreaAudience = new Map<string, Grade4>();
  for (const stat of result.areaStats) {
    gradeByAreaAudience.set(`${stat.area}\u0000${stat.audience}`, stat.grade4);
  }

  const headerRow1 = new TableRow({
    cantSplit: true,
    tableHeader: true,
    children: [
      headerCell("영역", 16, 1, 2),
      ...AUDIENCES.map((audience) => headerCell(AUDIENCE_SHORT_LABELS[audience], 21, 4, 1))
    ]
  });
  const headerRow2 = new TableRow({
    cantSplit: true,
    tableHeader: true,
    children: AUDIENCES.flatMap(() => GRADE4_ORDER.map((grade) => headerCell(grade, 5.25)))
  });

  const dataRows = AREAS.map(
    (area) =>
      new TableRow({
        cantSplit: true,
        children: [
          textCell(area.name, 16),
          ...AUDIENCES.flatMap((audience) => {
            const grade = gradeByAreaAudience.get(`${area.name}\u0000${audience}`);
            return GRADE4_ORDER.map((band) => centerCell(grade === band ? "✔" : "", 5.25));
          })
        ]
      })
  );

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, columnWidths: [1542, ...Array(16).fill(506)], rows: [headerRow1, headerRow2, ...dataRows] });
}

/** 서식3-1의 표2: 결과 분석 및 종합의견. category(구분)별로 findings를 나열. */
function findingsTable(findings: AiFinding[]): Table {
  const rows = FINDING_CATEGORIES.flatMap((category) => {
    const items = findings.filter((f) => f.category === category);
    if (items.length === 0) {
      return [
        new TableRow({
          cantSplit: false,
          children: [centerCell(category, 15), textCell("", 15), textCell("", 15), textCell("", 55)]
        })
      ];
    }
    return items.map(
      (finding) =>
        new TableRow({
          cantSplit: false,
          children: [
            centerCell(category, 15),
            textCell(finding.subarea, 15),
            textCell(finding.indicator, 15),
            textCell(
              [finding.content, finding.cause, finding.action].filter(Boolean).join("\n"),
              55
            )
          ].filter((c): c is TableCell => c !== undefined)
        })
    );
  });

  return new Table({
    layout: TableLayoutType.FIXED,
    columnWidths: [1446, 1446, 1446, 5300],
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        cantSplit: false,
        tableHeader: true,
        children: [headerCell("구분", 15), headerCell("세부영역", 15), headerCell("평가지표", 15), headerCell("내용", 55)]
      }),
      ...rows
    ]
  });
}

function featuredCasesTable(cases: Array<{ subarea: string; content: string }>): Table {
  const rows =
    cases.length > 0
      ? cases.map((item) => new TableRow({
      cantSplit: true, children: [textCell(item.subarea, 25), textCell(item.content, 75)] }))
      : [new TableRow({
      cantSplit: true, children: [textCell("", 25), textCell("", 75)] })];

  return new Table({
    layout: TableLayoutType.FIXED,
    columnWidths: [2410, 7228],
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
      cantSplit: true, tableHeader: true, children: [headerCell("세부영역", 25), headerCell("내용", 75)] }),
      ...rows
    ]
  });
}

/** 서식3-2: 실시한 평가지표·평가문항 전수. 같은 예시문항에서 대상별로 복제된 것(groupId)은 한 행으로. */
function itemListTable(items: SelectedQuestion[]): Table {
  const groups = groupByGroupId(items.filter((item) => !item.deleted));

  const rows = groups.map((group) => {
    const primary = group.find(item => item.audience === "teacher") ?? group[0];
    const audiencesInGroup = new Set(group.map((item) => item.audience));
    return new TableRow({
      cantSplit: true,
      children: [
        textCell(primary.area, 12),
        textCell(primary.subarea, 15),
        textCell(primary.indicator, 18),
        textCell(primary.editedQuestion || primary.originalQuestion, 35),
        ...AUDIENCES.map((audience) => centerCell(audiencesInGroup.has(audience) ? "○" : "", 5))
      ]
    });
  });

  return new Table({
    layout: TableLayoutType.FIXED,
    columnWidths: [1156, 1446, 1734, 3374, 482, 482, 482, 482],
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        cantSplit: true,
        tableHeader: true,
        children: [
          headerCell("영역", 12, 1, 2),
          headerCell("세부영역", 15, 1, 2),
          headerCell("평가지표", 18, 1, 2),
          headerCell("평가문항", 35, 1, 2),
          headerCell("평가주체", 20, 4)
        ]
      }),
      new TableRow({ cantSplit: true, tableHeader: true, children: AUDIENCES.map(audience => headerCell(AUDIENCE_SHORT_LABELS[audience], 5)) }),
      ...rows
    ]
  });
}

export type ReportDocxType = "submit" | "internal" | "draft";

/** 제출용: 서식3-1 + 서식3-2. 문항별 점수는 넣지 않습니다. */
export async function buildReportDocxSubmit(
  draft: SurveyDraft,
  items: SelectedQuestion[],
  result: SurveyResult
): Promise<Buffer> {
  const findings = (result.aiAnalysis?.areas.flatMap((a) => a.findings) ?? []).concat(
    result.aiAnalysis?.consultingNeeds ?? []
  );

  const children: FileChild[] = [
    textParagraph("[서식3-1] 학교평가서1(학교평가 영역별 결과 분석 및 종합의견)"),
    title("2026학년도 학교평가 영역별 결과 분석 및 종합의견"),
    schoolNameLine(draft),
    textParagraph("학교평가 영역별 평가 결과 (해당란에 “✔” 표시)", true),
    areaResultTable(result),
    koreanParagraph({
      children: [
        koreanRun(
          "※ 학교평가 영역별 평균점수 결과를 4단계 척도 [매우 우수(4.0 이상), 우수(3.0 이상~4.0 미만), 보통(2.0 이상~3.0 미만), 미흡(2.0 미만)]로 해당란에 표시"
        )
      ],
      spacing: { before: 120, after: 240 }
    }),
    textParagraph("2026학년도 학교평가 결과 분석 및 종합의견 (※ 필요한 경우 행을 가감하여 작성)", true),
    findingsTable(findings),
    ...(result.aiAnalysis?.overallOpinion ? [textParagraph('종합의견', true), textParagraph(result.aiAnalysis.overallOpinion)] : []),
    koreanParagraph({ children: [koreanRun("")], spacing: { after: 240 } }),
    textParagraph("2026학년도 학교교육활동 특색사례 (※ 자율 선택 작성, 학교평가 결과 연계 컨설팅 시 활용 예정)", true),
    featuredCasesTable(result.aiAnalysis?.featuredCases ?? []),
    koreanParagraph({
      children: [
        koreanRun(
          "※ 평가문항별 점수는 학교 자체 보관하며, 영역별 평균점수 결과만 학교평가서[서식3-1]에 작성"
        )
      ],
      spacing: { before: 240 }
    }),
    textParagraph("※ 교육지원청(교육연구정보원)제출 및 학교 누리집 탑재: 학교평가서 [서식3-1], [서식3-2] 전체"),
    new Paragraph({ pageBreakBefore: true, children: [] }),
    textParagraph("[서식3-2] 학교평가서2(평가지표 및 평가문항)"),
    title("2026학년도 학교평가서"),
    schoolNameLine(draft),
    koreanParagraph({
      children: [koreanRun("※ 필요한 부분에 행을 가감하여 실시한 평가지표와 평가문항 모두 작성")],
      spacing: { after: 200 }
    }),
    itemListTable(items)
  ];

  return renderDocx(children);
}

/** 교내 보관용: 주체별로 문항별 평균점수까지 넣습니다. 제출하지 않고 학교가 갖고 있습니다. */
export async function buildReportDocxInternal(
  draft: SurveyDraft,
  items: SelectedQuestion[],
  result: SurveyResult
): Promise<Buffer> {
  const statByKey = new Map<string, QuestionStat>();
  for (const stat of result.questionStats) {
    if (stat.grade === undefined) {
      statByKey.set(`${stat.questionId}\u0000${stat.audience}`, stat);
    }
  }

  const children: FileChild[] = [title("2026학년도 학교평가서 (교내 보관용 — 문항별 점수 포함)"), schoolNameLine(draft)];

  for (const audience of AUDIENCES) {
    const audienceItems = items.filter((item) => item.audience === audience && !item.deleted);
    if (audienceItems.length === 0) continue;

    const rows = audienceItems.map((item) => {
      const stat = statByKey.get(`${item.id}\u0000${audience}`);
      const scoreText = stat && stat.responseCount > 0 ? roundToOneDecimal(stat.mean).toFixed(1) : "-";
      return new TableRow({
        cantSplit: true,
        children: [
          textCell(item.area, 12),
          textCell(item.subarea, 15),
          textCell(item.indicator, 18),
          textCell(item.editedQuestion || item.originalQuestion, 45),
          centerCell(scoreText, 10)
        ]
      });
    });

    children.push(
      textParagraph(`${AUDIENCE_SHORT_LABELS[audience]}용`, true),
      new Table({
        layout: TableLayoutType.FIXED,
        columnWidths: [482, 1928, 1928, 4336, 964],
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            cantSplit: true,
            tableHeader: true,
            children: [
              headerCell("영역", 12),
              headerCell("세부영역", 15),
              headerCell("평가지표", 18),
              headerCell("평가문항", 45),
              headerCell("평균점수", 10)
            ]
          }),
          ...rows
        ]
      }),
      koreanParagraph({ children: [koreanRun("")], spacing: { after: 240 } })
    );
  }

  return renderDocx(children);
}

async function renderDocx(children: FileChild[]): Promise<Buffer> {
  const document = new Document({
    styles: {
      default: {
        document: { run: KOREAN_RUN_DEFAULTS },
        heading1: { run: KOREAN_RUN_DEFAULTS }
      }
    },
    compatibility: { useFELayout: true },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }]
  });
  return Packer.toBuffer(document);
}

export function reportDocxFileName(draft: SurveyDraft, type: ReportDocxType): string {
  const safe = draft.schoolName.replace(/[<>:"/\\|?*\s]+/g, "_");
  const suffix = type === "submit" ? "제출용" : type === "draft" ? "작성용" : "보관용";
  return `학교평가서_${suffix}_${safe}.docx`;
}
