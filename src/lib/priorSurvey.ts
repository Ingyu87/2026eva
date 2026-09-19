import { areaOfSubarea, isCurrentSubarea, SUBAREA_CHANGES_2025_TO_2026 } from "./evaluationFramework";
import { callGeminiWithPdf, parseGeminiJson } from "./gemini";
import type { Audience } from "./types";

export type PriorSurveyItem = {
  audience: Audience;
  area: string;
  subarea: string;
  indicator: string;
  question: string;
};

type RawItem = {
  audience?: string;
  subarea?: string;
  indicator?: string;
  question?: string;
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
          question: { type: "STRING", description: "문항 문장" }
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
          question: { type: "string", description: "문항 문장" }
        }
      }
    }
  }
};

function parseAudience(raw?: string): Audience {
  const text = (raw ?? "").replace(/\s/g, "");
  if (text.includes("학부모")) return "parent";
  if (text.includes("학생")) return "student";
  if (text.includes("직원")) return "staff";
  if (text.includes("교원") || text.includes("교사")) return "teacher";
  return "teacher";
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

export function normalizePriorSurveyItems(rawItems: RawItem[]): PriorSurveyItem[] {
  const seen = new Set<string>();
  const items: PriorSurveyItem[] = [];
  for (const raw of rawItems) {
    const question = (raw.question ?? "").replace(/\s+/g, " ").trim();
    if (question.length < 8) {
      continue;
    }
    const subarea = suggestedSubarea(raw.subarea);
    const area = areaOfSubarea(subarea)?.name ?? "";
    const key = `${parseAudience(raw.audience)}|${question}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({
      audience: parseAudience(raw.audience),
      area,
      subarea,
      indicator: (raw.indicator ?? "").trim() || "학교 자체 문항",
      question
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
      "척도 보기(매우 그렇다 등)와 안내문은 빼세요.",
      "audience는 교원/학부모/학생/직원 중 하나입니다. 구분이 없으면 교원입니다."
    ].join("\n"),
    base64,
    { responseSchema: GEMINI_SCHEMA, temperature: 0 }
  );
  const parsed = parseGeminiJson<{ items?: RawItem[] }>(text);
  return parsed.items ?? [];
}

export async function extractPriorSurveyPdf(buffer: Buffer): Promise<PriorSurveyItem[]> {
  const base64 = buffer.toString("base64");
  let raw: RawItem[] = [];
  if (process.env.UPSTAGE_API_KEY?.trim()) {
    raw = await extractWithUpstage(base64);
  } else if (process.env.GEMINI_API_KEY?.trim()) {
    raw = await extractWithGemini(base64);
  } else {
    throw new Error("서버에 UPSTAGE_API_KEY 또는 GEMINI_API_KEY가 필요합니다.");
  }
  const items = normalizePriorSurveyItems(raw);
  if (items.length === 0) {
    throw new Error("문항을 찾지 못했습니다.");
  }
  return items;
}

