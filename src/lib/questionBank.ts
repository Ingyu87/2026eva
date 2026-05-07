import teacherRows from "../../json_export/교원용.json";
import parentRows from "../../json_export/학부모용.json";
import studentRows from "../../json_export/학생용.json";
import staffRows from "../../json_export/직원용.json";
import { AUDIENCE_LABELS, type Audience, type QuestionBankItem } from "./types";

type RawQuestionRow = Record<string, unknown>;

const sources: Array<{
  audience: Audience;
  sourceSheet: string;
  rows: RawQuestionRow[];
}> = [
  { audience: "teacher", sourceSheet: "교원용", rows: teacherRows as RawQuestionRow[] },
  { audience: "parent", sourceSheet: "학부모용", rows: parentRows as RawQuestionRow[] },
  { audience: "student", sourceSheet: "학생용", rows: studentRows as RawQuestionRow[] },
  { audience: "staff", sourceSheet: "직원용", rows: staffRows as RawQuestionRow[] }
];

function text(row: RawQuestionRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function numberValue(row: RawQuestionRow): number {
  for (const value of Object.values(row)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      return Number(value.trim());
    }
  }
  return 0;
}

export const questionBank: QuestionBankItem[] = sources.flatMap((source) =>
  source.rows
    .map((row, index): QuestionBankItem => {
      const sourceRow = numberValue(row) || index + 4;
      return {
        id: `${source.audience}-${sourceRow}-${index}`,
        audience: source.audience,
        audienceLabel: AUDIENCE_LABELS[source.audience],
        sourceSheet: source.sourceSheet,
        sourceRow,
        area: text(row, ["영역", "(2025) 영역"]),
        subarea: text(row, ["세부영역", "(2025) 세부영역"]),
        indicator: text(row, ["평가지표", "(2025) 평가지표"]),
        question: text(row, ["평가문항", "평가문항(2025 평가지표 반영)"])
      };
    })
    .filter((row) => row.area && row.subarea && row.indicator && row.question)
);

export function getQuestionBankByAudience(audience: Audience): QuestionBankItem[] {
  return questionBank.filter((item) => item.audience === audience);
}
