import { AUDIENCES, AUDIENCE_SHORT_LABELS, type Audience } from "./types";

/**
 * 2026학년도 학교평가 평가체제.
 *
 * 영역과 세부영역은 법령(초·중등교육법시행령)과 서울특별시교육청 정책으로 정해져
 * **학교가 수정할 수 없습니다.** (기본계획 Ⅴ-3-가-2, 가이드북 Q6)
 * 평가지표와 평가문항만 학교가 자율로 구성합니다.
 *
 * 이 파일이 문항 적재·검증·제출 서식의 기준점입니다.
 */

export const FRAMEWORK_YEAR = 2026;

export type AreaCode = "Ⅰ" | "Ⅱ" | "Ⅲ";

export type AreaDef = {
  code: AreaCode;
  name: string;
  subareas: string[];
};

export const AREAS: AreaDef[] = [
  {
    code: "Ⅰ",
    name: "Ⅰ. 협력적 학교자치문화",
    subareas: [
      "Ⅰ-1. 소통과 협력의 학교자치",
      "Ⅰ-2. 학부모 및 지역사회 연계",
      "Ⅰ-3. 공감과 소통의 행정"
    ]
  },
  {
    code: "Ⅱ",
    name: "Ⅱ. 교육과정 운영 및 교수·학습 방법",
    subareas: [
      "Ⅱ-1. 교육과정 편성·운영",
      "Ⅱ-2. 수업·평가 혁신",
      "Ⅱ-3. 교원 전문성 신장"
    ]
  },
  {
    code: "Ⅲ",
    name: "Ⅲ. 교육 활동 및 교육 성과",
    subareas: [
      "Ⅲ-1. 모두를 위한 맞춤형 교육",
      "Ⅲ-2. 미래역량 교육",
      "Ⅲ-3. 안전하고 행복한 학교",
      "Ⅲ-4. 기타(학교 유형, 특성에 따른 세부영역)"
    ]
  }
];

export const SUBAREAS: string[] = AREAS.flatMap((area) => area.subareas);

const AREA_BY_SUBAREA = new Map(
  AREAS.flatMap((area) => area.subareas.map((subarea) => [subarea, area]))
);

export function areaOfSubarea(subarea: string): AreaDef | null {
  return AREA_BY_SUBAREA.get(subarea) ?? null;
}

/** 2026 체계에 없는 값인지 확인합니다. 2025 자료로 만든 초안을 가려낼 때 씁니다. */
export function isCurrentSubarea(subarea: string): boolean {
  return AREA_BY_SUBAREA.has(subarea);
}

/**
 * 2025 → 2026 세부영역 개편 내역. (가이드북 p.47 Q1)
 *
 * 화면에서 "이 문항은 옛 분류입니다"를 안내할 때만 씁니다.
 * **자동 변환은 하지 않습니다.** Ⅲ-2와 Ⅲ-3이 하나로 합쳐졌기 때문에,
 * 기계가 옮기면 엉뚱한 세부영역에 들어갈 수 있습니다. 사람이 다시 고르게 합니다.
 */
export const SUBAREA_CHANGES_2025_TO_2026: Array<{
  from: string;
  to: string;
  note?: string;
}> = [
  { from: "Ⅰ-1. 소통과 협력의 학교자치 기반 조성", to: "Ⅰ-1. 소통과 협력의 학교자치" },
  { from: "Ⅰ-3. 행정·예산", to: "Ⅰ-3. 공감과 소통의 행정" },
  { from: "Ⅲ-1. 맞춤형 책임교육", to: "Ⅲ-1. 모두를 위한 맞춤형 교육" },
  {
    from: "Ⅲ-2. 인문·과학·예체능교육",
    to: "Ⅲ-2. 미래역량 교육",
    note: "Ⅲ-3. 민주시민교육과 통합되었습니다. 어느 지표로 옮길지 직접 고르세요."
  },
  {
    from: "Ⅲ-3. 민주시민교육",
    to: "Ⅲ-2. 미래역량 교육",
    note: "Ⅲ-2. 인문·과학·예체능교육과 통합되었습니다. 어느 지표로 옮길지 직접 고르세요."
  },
  { from: "Ⅲ-4. 안전하고 쾌적한 교육환경", to: "Ⅲ-3. 안전하고 행복한 학교" },
  { from: "Ⅲ-5. 기타", to: "Ⅲ-4. 기타(학교 유형, 특성에 따른 세부영역)" }
];

/**
 * 학생·학부모·교원은 Ⅰ·Ⅱ·Ⅲ **모든 영역**을 평가해야 합니다.
 * 직원만 일부 영역으로 한정할 수 있습니다. (가이드북 Q9)
 *
 * 특히 "Ⅰ. 협력적 학교자치문화" 설문에서 학생을 빼지 않도록 유의하라고
 * 가이드북이 명시합니다.
 */
export function requiresAllAreas(audience: Audience): boolean {
  return audience !== "staff";
}

export const REQUIRED_AREA_CODES: AreaCode[] = ["Ⅰ", "Ⅱ", "Ⅲ"];

/** 해당 대상에서 빠진 필수 영역. 직원은 빈 배열입니다. */
export function missingRequiredAreas(
  items: Array<{ area: string }>,
  audience: Audience
): AreaCode[] {
  if (!requiresAllAreas(audience)) {
    return [];
  }
  return REQUIRED_AREA_CODES.filter((code) => !items.some((item) => item.area.startsWith(code)));
}

/**
 * 문항이 하나라도 있는 대상만 검사합니다. 폼을 안 만드는 빈 대상은 빼 둡니다.
 */
export function coverageGaps(
  items: Array<{ audience: Audience; area: string; deleted?: boolean }>
): Array<{ audience: Audience; missing: AreaCode[] }> {
  const live = items.filter((item) => !item.deleted);
  return AUDIENCES.flatMap((audience) => {
    const subset = live.filter((item) => item.audience === audience);
    if (subset.length === 0) {
      return [];
    }
    const missing = missingRequiredAreas(subset, audience);
    return missing.length > 0 ? [{ audience, missing }] : [];
  });
}

export function confirmCoverageGaps(
  items: Array<{ audience: Audience; area: string; deleted?: boolean }>
): boolean {
  const gaps = coverageGaps(items);
  if (gaps.length === 0) {
    return true;
  }
  const lines = gaps.map(
    (gap) => `${AUDIENCE_SHORT_LABELS[gap.audience]}: ${gap.missing.join("·")}영역 문항 없음`
  );
  return window.confirm(
    `${lines.join("\n")}\n\n학생·학부모·교원은 전 영역을 평가해야 합니다. (가이드북 Q9)\n그래도 진행할까요?`
  );
}

/** 세부영역으로 영역을 확정합니다. 목록 밖이면 null입니다. */
export function placementFromSubarea(subarea: string): { area: string; subarea: string } | null {
  const area = areaOfSubarea(subarea);
  return area ? { area: area.name, subarea } : null;
}

/** 트리에서 고른 값이 있으면 그걸, 없으면 첫 세부영역을 씁니다. */
export function defaultSubareaFromSelection(selection: {
  area?: string;
  subarea?: string;
}): string {
  if (selection.subarea && AREA_BY_SUBAREA.has(selection.subarea)) {
    return selection.subarea;
  }
  if (selection.area) {
    const area = AREAS.find((entry) => entry.name === selection.area);
    if (area) {
      return area.subareas[0];
    }
  }
  return SUBAREAS[0];
}

/** 평가 결과를 4단계 척도로 옮길 때 쓰는 구간. (가이드북 p.51) */
export const GRADE_BANDS = [
  { min: 4.0, label: "매우 우수" },
  { min: 3.0, label: "우수" },
  { min: 2.0, label: "보통" },
  { min: 0, label: "미흡" }
] as const;

export type GradeLabel = (typeof GRADE_BANDS)[number]["label"];

/**
 * 영역 평균점수를 4단계 척도로 옮깁니다.
 *
 * ⚠️ **반올림 전 원값**을 넣으세요. 반올림한 값을 넣으면 3.999가 4.0으로 올라가
 * "매우 우수"로 잘못 판정됩니다(spec.md 10.1 경계값 테스트: 3.999 → 우수, 4.0 → 매우 우수).
 * 화면 표시용 반올림은 판정과 별개로 `src/lib/scoring.ts`의 `roundToOneDecimal()`로 합니다.
 */
export function toGrade(mean: number): GradeLabel {
  return (GRADE_BANDS.find((band) => mean >= band.min) ?? GRADE_BANDS[3]).label;
}
