/**
 * Gemini 해석 (spec.md 4.9, prd.md 6장).
 *
 * 계산은 이미 끝난 상태로 들어옵니다(`QuestionStat`/`AreaStat`). 여기서는 그 숫자를
 * 해석한 문장을 만들고, 문장에 붙은 근거 숫자가 실제 집계와 맞는지 검증합니다.
 * **점수 계산은 절대 하지 않습니다.**
 */

import { callGemini, parseGeminiJson } from "./gemini";
import { roundToOneDecimal } from "./scoring";
import {
  AUDIENCES,
  AUDIENCE_SHORT_LABELS,
  type AiAnalysis,
  type AiEvidence,
  type AiFinding,
  type Audience,
  type AreaStat,
  type QuestionStat,
  type SelectedQuestion
} from "./types";

const SUBJECT_LABEL_TO_AUDIENCE: Record<string, Audience> = Object.fromEntries(
  AUDIENCES.map((audience) => [AUDIENCE_SHORT_LABELS[audience], audience])
) as Record<string, Audience>;

const MAX_RETRIES = 2; // spec.md 4.9: 최대 2회 재생성 (총 3회 시도)
const EVIDENCE_TOLERANCE = 0.05;

export type AnalysisInput = {
  schoolName: string;
  /** 학교교육목표·비전, 중점 교육활동 등 자유 서술. 없어도 됩니다. */
  schoolContext?: string;
  items: SelectedQuestion[];
  questionStats: QuestionStat[];
  areaStats: AreaStat[];
  /** 마스킹까지 끝낸 서술형 응답만 넘기세요. 여기서는 다시 마스킹하지 않습니다. */
  maskedFreeText: Array<{ audience: Audience; text: string }>;
  /** 전년도 평가서의 개선과제(4.10). 없으면 환류 확인 문장을 만들지 않습니다. */
  priorFindings?: Array<{ area: string; subarea: string; category: string; content: string; plan: string }>;
};

const FINDING_SCHEMA = {
  type: "OBJECT",
  properties: {
    category: {
      type: "STRING",
      enum: ["우수한 점", "개선할 점", "컨설팅장학 등 교육청 지원이 필요한 부분"]
    },
    subarea: { type: "STRING" },
    indicator: { type: "STRING" },
    content: { type: "STRING" },
    cause: { type: "STRING" },
    action: { type: "STRING" },
    evidence: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          questionId: { type: "STRING" },
          subject: { type: "STRING", enum: ["학생", "학부모", "교원", "직원"] },
          value: { type: "NUMBER" }
        },
        required: ["questionId", "subject", "value"]
      }
    }
  },
  required: ["category", "subarea", "indicator", "content", "evidence"]
} as const;

const ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    areas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          area: { type: "STRING" },
          findings: { type: "ARRAY", items: FINDING_SCHEMA }
        },
        required: ["area", "findings"]
      }
    },
    consultingNeeds: { type: "ARRAY", items: FINDING_SCHEMA },
    featuredCases: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { subarea: { type: "STRING" }, content: { type: "STRING" } },
        required: ["subarea", "content"]
      }
    },
    overallOpinion: { type: "STRING" }
  },
  required: ["areas", "consultingNeeds", "featuredCases", "overallOpinion"]
} as const;

function indicatorLookup(items: SelectedQuestion[]): Map<string, SelectedQuestion> {
  return new Map(items.map((item) => [item.id, item]));
}

/** 문항×주체×전체(학년 구분 없음) 평균만 골라 근거 대조표를 만듭니다. */
function buildEvidenceTable(questionStats: QuestionStat[]): Map<string, number> {
  const table = new Map<string, number>();
  for (const stat of questionStats) {
    if (stat.grade !== undefined) {
      continue; // 근거는 전체 평균 기준. 학년별 숫자는 결과 보고서에서만 씀
    }
    table.set(`${stat.questionId}__${stat.audience}`, roundToOneDecimal(stat.mean));
  }
  return table;
}

function renderStatsTable(items: SelectedQuestion[], questionStats: QuestionStat[], areaStats: AreaStat[]): string {
  const byId = indicatorLookup(items);
  const lines: string[] = [];

  lines.push("[문항별 평균] questionId | 영역 | 세부영역 | 평가지표 | 주체 | 평균 | 응답자수");
  for (const stat of questionStats) {
    if (stat.grade !== undefined) continue;
    const item = byId.get(stat.questionId);
    if (!item) continue;
    lines.push(
      `${stat.questionId} | ${item.area} | ${item.subarea} | ${item.indicator} | ${AUDIENCE_SHORT_LABELS[stat.audience]} | ${roundToOneDecimal(stat.mean)} | ${stat.responseCount}`
    );
  }

  lines.push("");
  lines.push("[학생 학년별 평균] questionId | 학년 | 평균");
  for (const stat of questionStats) {
    if (stat.grade === undefined) continue;
    lines.push(`${stat.questionId} | ${stat.grade}학년 | ${roundToOneDecimal(stat.mean)}`);
  }

  lines.push("");
  lines.push("[영역별 평균 및 4단계 판정] 영역 | 주체 | 평균 | 판정");
  for (const stat of areaStats) {
    lines.push(`${stat.area} | ${AUDIENCE_SHORT_LABELS[stat.audience]} | ${stat.meanRounded} | ${stat.grade4}`);
  }

  return lines.join("\n");
}

function buildPrompt(input: AnalysisInput): string {
  const parts: string[] = [];
  parts.push(
    "당신은 서울특별시 초등학교 학교평가서 작성을 돕는 분석가입니다. 아래 집계 결과만 근거로 삼아 분석하세요.",
    "숫자를 지어내지 마세요. 모든 문장의 근거(evidence)는 반드시 아래 표에 있는 questionId·주체·평균값과 정확히 일치해야 합니다.",
    ""
  );
  parts.push(`학교명: ${input.schoolName}`);
  if (input.schoolContext) {
    parts.push(`학교교육목표·중점활동: ${input.schoolContext}`);
  }
  parts.push("");
  parts.push(renderStatsTable(input.items, input.questionStats, input.areaStats));

  if (input.maskedFreeText.length > 0) {
    parts.push("", "[서술형 응답 원문 (개인정보 마스킹됨)]");
    for (const entry of input.maskedFreeText.slice(0, 200)) {
      parts.push(`(${AUDIENCE_SHORT_LABELS[entry.audience]}) ${entry.text}`);
    }
  }

  if (input.priorFindings && input.priorFindings.length > 0) {
    parts.push("", "[전년도 개선과제 — 올해 점수와 대조해 환류 여부를 확인하세요]");
    for (const finding of input.priorFindings) {
      parts.push(`${finding.area} / ${finding.subarea} (${finding.category}): ${finding.content} → 향후계획: ${finding.plan}`);
    }
  }

  parts.push(
    "",
    "다음 7가지 관점으로 분석하세요:",
    "1. 주체 간 인식 격차 해석 (같은 지표에서 주체별 점수 차이가 크면 원인을 해석)",
    "2. 학생 학년별 추세 (학년이 올라갈수록 점수가 떨어지는 항목이 있는지)",
    "3. 상대적 저점 (전체가 높은 점수여도 그 안에서 가장 낮은 항목)",
    "4. 숫자와 서술형 교차 확인 (점수가 낮고 서술형에서도 자주 언급되면 우선순위를 높임)",
    "5. 서술형 의견을 주제별로 묶어 제시",
    "6. 전년도 개선과제가 실제로 개선됐는지 대조 (전년도 자료가 있을 때만)",
    "7. 원인 → 개선방안 구조로 서술 (가이드북 p.37의 4단 구조: 평가결과·원인분석·개선방안)",
    "",
    "출력은 지정된 JSON 스키마를 그대로 따르세요. category는 서식3-1의 세 구분과 정확히 같은 문자열을 쓰세요.",
    "evidence의 subject는 반드시 \"학생\"·\"학부모\"·\"교원\"·\"직원\" 중 하나이고, value는 위 표의 평균값과 소수 첫째 자리까지 정확히 같아야 합니다."
  );

  return parts.join("\n");
}

function extractDecimalNumbers(text: string): number[] {
  const matches = text.match(/\d+\.\d+/g) ?? [];
  return matches.map(Number);
}

/** 근거(evidence)가 실제 집계표에 있는 값인지 확인합니다. */
function evidenceIsValid(evidence: AiEvidence, evidenceTable: Map<string, number>): boolean {
  const audience = SUBJECT_LABEL_TO_AUDIENCE[evidence.subject];
  if (!audience) return false;
  const actual = evidenceTable.get(`${evidence.questionId}__${audience}`);
  return actual !== undefined && Math.abs(actual - evidence.value) < EVIDENCE_TOLERANCE;
}

/** 본문에 등장하는 소수(X.XX) 숫자가 evidence 또는 영역 평균 중 하나와는 맞아야 합니다. */
function bodyNumbersAreValid(finding: AiFinding, evidenceTable: Map<string, number>, areaValues: number[]): boolean {
  const text = [finding.content, finding.cause, finding.action].filter(Boolean).join(" ");
  const numbers = extractDecimalNumbers(text);
  if (numbers.length === 0) return true;
  const known = [...evidenceTable.values(), ...areaValues];
  return numbers.every((n) => known.some((v) => Math.abs(v - n) < EVIDENCE_TOLERANCE));
}

function verifyFinding(finding: AiFinding, evidenceTable: Map<string, number>, areaValues: number[]): boolean {
  if (finding.evidence.length === 0) {
    return false; // spec.md 4.9: evidence는 필수
  }
  return finding.evidence.every((e) => evidenceIsValid(e, evidenceTable)) && bodyNumbersAreValid(finding, evidenceTable, areaValues);
}

async function regenerateFindings(
  failing: AiFinding[],
  input: AnalysisInput,
  statsTable: string
): Promise<AiFinding[]> {
  const prompt = [
    "아래 항목들의 evidence 숫자가 실제 집계와 맞지 않아 다시 만들어야 합니다.",
    "같은 집계표를 다시 드립니다. 이번에는 evidence의 value가 표의 값과 정확히 일치하게 만드세요.",
    "",
    statsTable,
    "",
    "다시 만들 항목(같은 개수, 같은 순서로 돌려주세요):",
    JSON.stringify(failing.map(({ category, subarea, indicator }) => ({ category, subarea, indicator })))
  ].join("\n");

  const text = await callGemini(prompt, {
    responseSchema: { type: "ARRAY", items: FINDING_SCHEMA }
  });
  return parseGeminiJson<AiFinding[]>(text);
}

/** 실패한 finding을 비우고 확인 필요 표시를 답니다. 카테고리·지표명은 남겨 화면에서 알아볼 수 있게 합니다. */
function blankFinding(finding: AiFinding): AiFinding {
  return {
    ...finding,
    content: "",
    cause: undefined,
    action: undefined,
    evidence: [],
    needsReview: true
  };
}

async function verifyAndFixFindings(
  findings: AiFinding[],
  input: AnalysisInput,
  evidenceTable: Map<string, number>,
  areaValues: number[],
  statsTable: string
): Promise<AiFinding[]> {
  let current = findings;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const failingIndexes = current
      .map((finding, index) => (verifyFinding(finding, evidenceTable, areaValues) ? -1 : index))
      .filter((index) => index !== -1);

    if (failingIndexes.length === 0) {
      return current;
    }

    const failing = failingIndexes.map((index) => current[index]);
    let regenerated: AiFinding[];
    try {
      regenerated = await regenerateFindings(failing, input, statsTable);
    } catch {
      break; // 재생성 호출 자체가 실패하면 더 재시도하지 않고 최종 검증으로 넘어감
    }

    current = current.slice();
    failingIndexes.forEach((index, i) => {
      if (regenerated[i]) {
        current[index] = { ...regenerated[i], evidence: regenerated[i].evidence ?? [] };
      }
    });
  }

  return current.map((finding) => (verifyFinding(finding, evidenceTable, areaValues) ? finding : blankFinding(finding)));
}

/** 7단계 핵심 함수. Gemini를 호출하고, 환각 방지 검증·재생성까지 마친 결과를 돌려줍니다. */
export async function analyzeResults(input: AnalysisInput): Promise<AiAnalysis> {
  const statsTable = renderStatsTable(input.items, input.questionStats, input.areaStats);
  const prompt = buildPrompt(input);

  const text = await callGemini(prompt, { responseSchema: ANALYSIS_SCHEMA });
  const analysis = parseGeminiJson<AiAnalysis>(text);

  const evidenceTable = buildEvidenceTable(input.questionStats);
  const areaValues = input.areaStats.map((stat) => stat.meanRounded);

  const areas = await Promise.all(
    analysis.areas.map(async (areaAnalysis) => ({
      area: areaAnalysis.area,
      findings: await verifyAndFixFindings(areaAnalysis.findings, input, evidenceTable, areaValues, statsTable)
    }))
  );
  const consultingNeeds = await verifyAndFixFindings(
    analysis.consultingNeeds,
    input,
    evidenceTable,
    areaValues,
    statsTable
  );

  return {
    areas,
    consultingNeeds,
    featuredCases: analysis.featuredCases ?? [],
    overallOpinion: analysis.overallOpinion ?? ""
  };
}
