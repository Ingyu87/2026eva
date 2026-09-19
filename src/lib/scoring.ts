/**
 * 점수 계산 (가이드북 p.51, spec.md 4.8).
 *
 * ⚠️ 이 계산은 AI가 아니라 프로그램이 합니다. `scripts/verify-scoring.mjs`가
 * 가이드북 51쪽 예시와 경계값을 고정해 둡니다. 공식을 바꿀 때는 그 스크립트도 같이 고치세요.
 */

import { toGrade, type GradeLabel } from "./evaluationFramework";
import {
  LIKERT_5_OPTIONS,
  countsTowardAreaMean,
  type Audience,
  type AreaStat,
  type Distribution5,
  type QuestionStat,
  type ResponseType
} from "./types";

export type { Distribution5, QuestionStat, AreaStat };

const LIKERT_LABEL_TO_SCORE: Record<string, number> = Object.fromEntries(
  LIKERT_5_OPTIONS.map((label, index) => [label, LIKERT_5_OPTIONS.length - index])
);

/**
 * 라벨 문자열을 척도값으로 바꿉니다. **반드시 라벨 기준**입니다 (가이드북 p.51).
 *
 * 순서·인덱스로 계산하지 마세요. 저장소의 옛 설문 JSON은 `value 1 = 매우 그렇다`로
 * 뒤집혀 있어서, 인덱스 기반으로 짜면 4.9점이 최악 평가가 됩니다.
 * 척도 라벨이 아니면(서술형·선택형 응답 등) `null`을 돌려줍니다.
 */
export function scoreForLabel(label: string): number | null {
  const score = LIKERT_LABEL_TO_SCORE[label.trim()];
  return typeof score === "number" ? score : null;
}

export function emptyDistribution(): Distribution5 {
  return [0, 0, 0, 0, 0];
}

export function distributionCount(distribution: Distribution5): number {
  return distribution[0] + distribution[1] + distribution[2] + distribution[3] + distribution[4];
}

export function mergeDistributions(distributions: Distribution5[]): Distribution5 {
  const merged = emptyDistribution();
  for (const distribution of distributions) {
    for (let i = 0; i < 5; i += 1) {
      merged[i] += distribution[i];
    }
  }
  return merged;
}

/** 라벨 응답 목록을 분포로 바꿉니다. 척도 라벨이 아닌 값은 건너뜁니다(무효 응답 취급). */
export function buildDistribution(labels: string[]): Distribution5 {
  const distribution = emptyDistribution();
  for (const raw of labels) {
    const score = scoreForLabel(raw);
    if (score === null) {
      continue;
    }
    distribution[5 - score] += 1;
  }
  return distribution;
}

/**
 * 가중평균. 문항 평균과 영역 평균에 똑같이 씁니다.
 *
 * 문항 평균 = Σ(응답자 수 × 척도값) / 문항 전체 응답자 수
 * 영역 평균 = Σ(영역 응답 소계 × 척도값) / 영역 문항 응답 합계
 *
 * 두 식은 모양이 같습니다. **영역 평균은 문항 평균들의 단순 평균이 아니라**,
 * 영역에 속한 문항들의 분포를 먼저 합친 뒤(`mergeDistributions`) 이 함수로 다시 구합니다.
 */
export function weightedMean(distribution: Distribution5): number {
  const total = distributionCount(distribution);
  if (total === 0) {
    return 0;
  }
  const sum =
    distribution[0] * 5 + distribution[1] * 4 + distribution[2] * 3 + distribution[3] * 2 + distribution[4] * 1;
  return sum / total;
}

/** 화면 표시용 반올림. 소수 둘째 자리에서 반올림해 소수 첫째 자리로 만듭니다. 판정에는 쓰지 않습니다. */
export function roundToOneDecimal(mean: number): number {
  return Math.round(mean * 10) / 10;
}

/**
 * 4단계 판정. **반올림 전 원값**으로 매깁니다 (evaluationFramework.ts `toGrade` 참고).
 * 부동소수점 나눗셈 오차만 6자리에서 정리하고, 그 외에는 반올림하지 않습니다.
 */
export function gradeForMean(mean: number): GradeLabel {
  return toGrade(mean);
}

export function computeQuestionStat(
  questionId: string,
  audience: Audience,
  labels: string[],
  grade?: number
): QuestionStat {
  const distribution = buildDistribution(labels);
  return {
    questionId,
    audience,
    grade,
    distribution,
    responseCount: distributionCount(distribution),
    mean: weightedMean(distribution)
  };
}

export type AreaMeanItem = {
  questionId: string;
  audience: Audience;
  area: string;
  responseType: ResponseType;
};

/**
 * 영역 평균 산출. **5점 척도 문항만** 넣습니다(`countsTowardAreaMean`).
 * 서술형·선택형은 정성평가·선호도 조사로 병행하되 이 집계에서는 뺍니다
 * (types.ts `countsTowardAreaMean`, spec.md 4.4).
 *
 * 영역 × 평가주체 조합마다 하나씩 만듭니다(서식3-1: 3영역 × 4주체 × 4단계).
 */
export function computeAreaStats(items: AreaMeanItem[], questionStats: QuestionStat[]): AreaStat[] {
  const statByQuestionId = new Map(questionStats.map((stat) => [stat.questionId, stat]));
  const groups = new Map<string, { area: string; audience: Audience; distributions: Distribution5[] }>();

  for (const item of items) {
    if (!countsTowardAreaMean(item.responseType)) {
      continue;
    }
    const stat = statByQuestionId.get(item.questionId);
    if (!stat || stat.audience !== item.audience || stat.responseCount === 0) {
      continue;
    }
    const key = `${item.area}__${item.audience}`;
    const group = groups.get(key) ?? { area: item.area, audience: item.audience, distributions: [] };
    group.distributions.push(stat.distribution);
    groups.set(key, group);
  }

  return Array.from(groups.values()).map(({ area, audience, distributions }) => {
    const subtotal = mergeDistributions(distributions);
    const mean = weightedMean(subtotal);
    return {
      area,
      audience,
      subtotal,
      mean,
      meanRounded: roundToOneDecimal(mean),
      grade4: gradeForMean(mean)
    };
  });
}
