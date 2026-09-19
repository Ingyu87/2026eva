/**
 * Gemini API 얇은 래퍼. spec.md 1.1: Gemini는 계산된 숫자와 글을 **해석**하는 데만 씁니다.
 * 계산은 절대 여기서 하지 않습니다 (`src/lib/scoring.ts` 참고).
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// "gemini-2.5-pro"는 신규 키에 더 이상 제공되지 않습니다(2026-09-19 확인). 별칭을 쓰면
// 구글이 안정판을 바꿔도 코드를 고치지 않아도 됩니다. 고정하려면 GEMINI_MODEL 환경변수를 쓰세요.
const DEFAULT_MODEL = "gemini-pro-latest";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경변수 ${name}이(가) 설정되지 않았습니다. .env.local을 확인하세요.`);
  }
  return value;
}

export type GeminiSchema = Record<string, unknown>;

export type GeminiCallOptions = {
  model?: string;
  responseSchema?: GeminiSchema;
  temperature?: number;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
};

/** Gemini에 구조화 JSON 응답을 요청하고, 파싱된 텍스트(JSON 문자열)를 그대로 돌려줍니다. */
export async function callGemini(prompt: string, options: GeminiCallOptions = {}): Promise<string> {
  const apiKey = requiredEnv("GEMINI_API_KEY");
  const model = options.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      responseMimeType: "application/json",
      ...(options.responseSchema ? { responseSchema: options.responseSchema } : {})
    }
  };

  const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini API 호출에 실패했습니다. ${detail}`);
  }

  const json = (await response.json()) as GeminiResponse;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const reason = json.candidates?.[0]?.finishReason ?? "unknown";
    throw new Error(`Gemini 응답에서 내용을 찾을 수 없습니다. (finishReason: ${reason})`);
  }
  return text;
}

/** Gemini가 돌려준 JSON 텍스트를 파싱합니다. 스키마를 지정해도 가끔 코드펜스가 섞여 오므로 방어합니다. */
export function parseGeminiJson<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "");
  return JSON.parse(cleaned) as T;
}
