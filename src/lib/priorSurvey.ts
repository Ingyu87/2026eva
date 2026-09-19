import { AREAS, areaOfSubarea, isCurrentSubarea, SUBAREA_CHANGES_2025_TO_2026 } from "./evaluationFramework";
import { callGeminiWithPdf, parseGeminiJson } from "./gemini";
import { RESPONSE_TYPES, LIKERT_5_OPTIONS, LIKERT_3_OPTIONS, YES_NO_OPTIONS, type Audience, type ResponseType } from "./types";

export type PriorSurveyItem = {
  audience: Audience;
  area: string;
  subarea: string;
  indicator: string;
  question: string;
  responseType: ResponseType | null;
  choices?: string[];
};

type RawItem = {
  audience?: string;
  subarea?: string;
  indicator?: string;
  question?: string;
  responseType?: string;
  choices?: string[];
  rows?: Array<{ label?: string; responseType?: string; choices?: string[]; textPrompt?: string }>;
};

const TABLE_INSTRUCTION = "학년군·증감 등 행마다 각각 응답하는 표는 하나의 items 항목 안에 rows로 추출하세요. rows의 label은 학년과 교육분야 등 행 제목 전체, responseType과 choices는 그 행의 선택 방식과 보기입니다. 대안·의견 직접 입력 칸은 textPrompt에 원문 칸 제목과 조건을 적으세요. 입력 칸이 없으면 생략하세요. 공유 보기는 각 행에 반복하세요. 선택 개수·조건은 question에 보존하세요. 표 행을 선택 보기 하나로 합치지 마세요. 단순 보기 배치용 표는 rows로 나누지 마세요.";

const TABLE_ROW_PROPERTIES = {
  label: { type: "STRING", description: "행 제목 전체(학년군, 교육분야 등)" },
  responseType: { type: "STRING", description: "choice_single, checklist, text 등 해당 행의 응답 유형" },
  choices: { type: "ARRAY", items: { type: "STRING" }, description: "이 행에 응답할 보기 전체" },
  textPrompt: { type: "STRING", description: "별도 직접 입력 칸의 제목과 조건. 없는 경우 생략" }
};

const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          audience: { type: "STRING", description: "교원, 학부모, 학생, 직원 중 하나" },
          subarea: { type: "STRING", description: "세부영역 이름" },
          indicator: { type: "STRING", description: "평가지표 이름" },
          question: { type: "STRING", description: "문항 원문" },
          responseType: { type: "STRING", description: "likert_5, likert_3, yes_no, choice_single, checklist, text. 불명확하면 unknown" },
          choices: { type: "ARRAY", items: { type: "STRING" }, description: "원문 보기 전체, 순서 유지" },
          rows: { type: "ARRAY", items: { type: "OBJECT", properties: TABLE_ROW_PROPERTIES, required: ["label", "responseType"] }, description: TABLE_INSTRUCTION }
        },
        required: ["question"]
      }
    }
  },
  required: ["items"]
} as const;

const UPSTAGE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          audience: { type: "string", description: "교원, 학부모, 학생, 직원" },
          subarea: { type: "string", description: "세부영역" },
          indicator: { type: "string", description: "평가지표" },
          question: { type: "string", description: "문항 원문" },
          responseType: { type: "string", description: "likert_5, likert_3, yes_no, choice_single, checklist, text. 불명확하면 unknown" },
          choices: { type: "array", items: { type: "string" } },
          rows: { type: "array", description: TABLE_INSTRUCTION, items: { type: "object", properties: {
            label: { type: "string" }, responseType: { type: "string" },
            choices: { type: "array", items: { type: "string" } }, textPrompt: { type: "string" }
          }, required: ["label", "responseType"] } }
        }
      }
    }
  }
};

export function parseAudience(raw?: string): Audience | undefined {
  const text = (raw ?? "").replace(/\s/g, "");
  if ((text.includes("학부모") || text.includes("보호자"))) return "parent";
  if (text.includes("학생")) return "student";
  if (text.includes("직원")) return "staff";
  if (text.includes("교원") || text.includes("교사")) return "teacher";
  return undefined;
}

function suggestedSubarea(raw?: string): string {
  const text = (raw ?? "").trim();
  if (text && isCurrentSubarea(text)) {
    return text;
  }
  const change = SUBAREA_CHANGES_2025_TO_2026.find((entry) => entry.from === text);
  if (change && !change.note && isCurrentSubarea(change.to)) {
    return change.to;
  }
  return "";
}

export function normalizePriorSurveyItems(rawItems: RawItem[], audienceHint?: Audience): PriorSurveyItem[] {
  const items: PriorSurveyItem[] = [];
  for (const raw of rawItems) {
    if (Array.isArray(raw.rows) && raw.rows.length) {
      const expanded: RawItem[] = [];
      for (const row of raw.rows) {
        if (!row.label?.trim()) throw new Error("표의 행 제목을 읽지 못했습니다. 원본 PDF를 확인한 뒤 다시 시도하세요.");
        const question = `${raw.question ?? ""} [${row.label.trim()}]`;
        expanded.push({ ...raw, rows: undefined, question, responseType: row.responseType ?? raw.responseType, choices: row.choices ?? raw.choices });
        if (row.textPrompt?.trim()) expanded.push({ ...raw, rows: undefined, question: `${question} — ${row.textPrompt.trim()}`, responseType: "text", choices: undefined });
      }
      items.push(...normalizePriorSurveyItems(expanded, audienceHint));
      continue;
    }
    const question = (raw.question ?? "").replace(/\s+/g, " ").trim();
    if (!question) {
      continue;
    }
    const subarea = suggestedSubarea(raw.subarea);
    const area = areaOfSubarea(subarea)?.name ?? "";
    const audience = audienceHint ?? parseAudience(raw.audience);
    let responseType = RESPONSE_TYPES.includes(raw.responseType as ResponseType) ? raw.responseType as ResponseType : null;
    const choices = Array.isArray(raw.choices) ? raw.choices.filter((c): c is string => typeof c === "string").map(c => c.trim()).filter(Boolean) : [];
    const scaleLabel = (label: string) => label.replace(/^\s*[①-⑳]\s*/, "").replace(/\s/g, "").replace(/[.]$/, "");
    const sameLabels = (labels: readonly string[]) => labels.length === choices.length && labels.every((label, index) => scaleLabel(label) === scaleLabel(choices[index]));
    // 표에서 줄바꿈·띄어쓰기가 사라져도 같은 척도입니다. 문구가 다른 척도는 바꾸지 않습니다.
    if (responseType === "choice_single" || responseType === null) {
      if (sameLabels(LIKERT_5_OPTIONS)) responseType = "likert_5";
      else if (sameLabels(LIKERT_3_OPTIONS)) responseType = "likert_3";
      else if (sameLabels(YES_NO_OPTIONS)) responseType = "yes_no";
    }
    const fixed = responseType === "likert_5" ? LIKERT_5_OPTIONS : responseType === "likert_3" ? LIKERT_3_OPTIONS : responseType === "yes_no" ? YES_NO_OPTIONS : undefined;
    if (fixed && choices.length && !sameLabels(fixed)) responseType = "choice_single";
    if (fixed && !choices.length) responseType = null;
    items.push({
      audience: audience ?? "teacher",
      area,
      subarea,
      indicator: (raw.indicator ?? "").trim() || "학교 자체 문항",
      question,
      responseType,
      choices: choices.length ? choices : undefined
    });
  }
  return items;
}

async function extractWithUpstage(base64: string): Promise<RawItem[]> {
  const apiKey = process.env.UPSTAGE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("no-upstage");
  }

  const response = await fetch("https://api.upstage.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "information-extract",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: TABLE_INSTRUCTION },
            {
              type: "image_url",
              image_url: { url: `data:application/pdf;base64,${base64}` }
            }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "prior_survey",
          schema: UPSTAGE_SCHEMA
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`문항지를 읽지 못했습니다. (${response.status})`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("문항지를 읽지 못했습니다.");
  }
  const parsed = JSON.parse(text) as { items?: RawItem[] };
  return parsed.items ?? [];
}

async function extractWithGemini(base64: string): Promise<RawItem[]> {
  const text = await callGeminiWithPdf(
    [
      "이 파일은 전년도 학교평가 설문 문항지입니다.",
      "모든 문항을 빠짐없이 items로 추출하세요.",
      TABLE_INSTRUCTION,
      `subarea는 올해 허용 목록에서 문항 내용에 맞는 값을 제안하세요. 확실하지 않으면 빈 문자열로 두세요: ${AREAS.flatMap(area => area.subareas).join(" / ")}`,
      "안내문은 빼고 문항 원문과 보기 전체를 순서대로 보존하세요. 복수 선택은 checklist, 자유 응답은 text입니다.",
      "likert_5는 매우 그렇다/그렇다/보통이다/그렇지 않다/전혀 그렇지 않다, likert_3는 그렇다/보통이다/그렇지 않다, yes_no는 예/아니오인 경우만 사용하세요. 다른 보기는 choice_single 또는 checklist로 보존하세요. 유형 불명확 시 unknown.",
      "audience는 교원/학부모/학생/직원 중 하나입니다. 구분이 없으면 교원입니다."
    ].join("\n"),
    base64,
    { responseSchema: GEMINI_SCHEMA, temperature: 0 }
  );
  const parsed = parseGeminiJson<{ items?: RawItem[] }>(text);
  return parsed.items ?? [];
}

export async function extractPriorSurveyPdf(buffer: Buffer, audienceHint?: Audience): Promise<PriorSurveyItem[]> {
  const base64 = buffer.toString("base64");
  let raw: RawItem[] = [];
  if (process.env.UPSTAGE_API_KEY?.trim()) {
    raw = await extractWithUpstage(base64);
  } else if (process.env.GEMINI_API_KEY?.trim()) {
    raw = await extractWithGemini(base64);
  } else {
    throw new Error("서버에 UPSTAGE_API_KEY 또는 GEMINI_API_KEY가 필요합니다.");
  }
  const items = normalizePriorSurveyItems(raw, audienceHint);
  if (items.length === 0) {
    throw new Error("문항을 찾지 못했습니다.");
  }
  return items;
}

