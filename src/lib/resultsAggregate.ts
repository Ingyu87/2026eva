/**
 * 확정된 결과 업로드(대상별 파일 + 연결표)를 실제 집계로 바꿉니다 (spec.md `/api/results/aggregate`).
 *
 * 계산 자체는 `scoring.ts`가 합니다. 이 모듈은 업로드된 행을 문항별 라벨 목록으로 갈라
 * 그 계산에 넣어 주는 배선 역할만 합니다.
 */

import { computeAreaStats, computeQuestionStat, type AreaMeanItem } from "./scoring";
import type { AreaStat, QuestionStat, ResultUpload, SelectedQuestion, SurveyResult } from "./types";

function parseGrade(label: string): number | null {
  const match = label.match(/(\d+)\s*학년/);
  return match ? Number(match[1]) : null;
}

export type AggregateResult = Pick<SurveyResult, "responsesByAudience" | "questionStats" | "areaStats">;

/**
 * 여러 대상의 업로드를 한 번에 집계합니다.
 *
 * 학생 업로드에 학년 열이 있으면 문항마다 "전체" 통계 하나와 학년별 통계를 각각 만듭니다.
 * 영역 평균은 학년 구분 없는 "전체" 통계로만 구합니다(서식3-1은 학년별이 아니라 주체별입니다).
 */
export function aggregateResultUploads(uploads: ResultUpload[], items: SelectedQuestion[]): AggregateResult {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const questionStats: QuestionStat[] = [];
  const responsesByAudience: Partial<Record<SelectedQuestion["audience"], number>> = {};

  for (const upload of uploads) {
    responsesByAudience[upload.audience] = (responsesByAudience[upload.audience] ?? 0) + upload.rows.length;

    const gradeColumnIndex = upload.mapping.findIndex((entry) => entry.isGrade);
    const gradesByRow: Array<number | null> =
      gradeColumnIndex === -1
        ? upload.rows.map(() => null)
        : upload.rows.map((row) => parseGrade(row[gradeColumnIndex] ?? ""));

    for (let colIndex = 0; colIndex < upload.mapping.length; colIndex += 1) {
      const questionId = upload.mapping[colIndex]?.questionId;
      if (!questionId || !itemById.has(questionId)) {
        continue;
      }

      const labelsByRow = upload.rows.map((row) => row[colIndex] ?? "");

      // 전체(학년 구분 없음) — 영역 평균과 결과 보고서 "전체" 열에 씀
      questionStats.push(computeQuestionStat(questionId, upload.audience, labelsByRow));

      if (gradeColumnIndex !== -1) {
        const grades = Array.from(new Set(gradesByRow.filter((g): g is number => g !== null))).sort(
          (a, b) => a - b
        );
        for (const grade of grades) {
          const labelsForGrade = labelsByRow.filter((_, rowIndex) => gradesByRow[rowIndex] === grade);
          questionStats.push(computeQuestionStat(questionId, upload.audience, labelsForGrade, grade));
        }
      }
    }
  }

  const overallStats = questionStats.filter((stat) => stat.grade === undefined);
  const areaItems: AreaMeanItem[] = overallStats
    .map((stat) => {
      const item = itemById.get(stat.questionId);
      return item ? { questionId: item.id, audience: item.audience, area: item.area, responseType: item.responseType } : null;
    })
    .filter((value): value is AreaMeanItem => value !== null);

  const areaStats: AreaStat[] = computeAreaStats(areaItems, overallStats);

  return { responsesByAudience, questionStats, areaStats };
}
