import { AUDIENCES, AUDIENCE_LABELS, type Audience, type SelectedQuestion } from "./types";

export type ExportAudience = Audience | "all";
export type SurveyFileFormat = "docx" | "hwpx";

/** 생략한 요청은 기존처럼 전체 대상. 잘못된 값은 전체 출력으로 바꾸지 않는다. */
export function parseExportAudience(value: string | null): ExportAudience {
  if (value === null || value === "all") return "all";
  if (AUDIENCES.includes(value as Audience)) return value as Audience;
  throw new Error("다운로드할 대상을 다시 선택해 주세요.");
}

export function selectExportItems(items: SelectedQuestion[], audience: ExportAudience): SelectedQuestion[] {
  return items.filter(item => !item.deleted && (audience === "all" || item.audience === audience));
}

export function audienceFileName(fileName: string, audience: ExportAudience): string {
  return audience === "all" ? fileName : fileName.replace(/\.(docx|hwpx)$/, `_${AUDIENCE_LABELS[audience]}.$1`);
}
