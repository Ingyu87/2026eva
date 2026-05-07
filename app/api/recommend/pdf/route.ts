import { PDFParse } from "pdf-parse";
import { jsonError, jsonOk, requireSchoolSession } from "@/lib/api";
import { questionBank } from "@/lib/questionBank";
import { AUDIENCES, type Audience } from "@/lib/types";

type RecommendationItem = {
  id: string;
  audience: Audience;
  indicator: string;
  question: string;
  area: string;
  subarea: string;
  score: number;
};

const STOP_WORDS = new Set([
  "그리고",
  "또한",
  "대한",
  "위한",
  "에서",
  "으로",
  "입니다",
  "있습니다",
  "학교",
  "평가",
  "설문",
  "문항",
  "학기",
  "학년도",
  "운영"
]);

const AUDIENCE_HEADERS: Record<Audience, string[]> = {
  teacher: ["교원용", "교원", "교사용", "교사"],
  parent: ["학부모용", "학부모", "보호자용", "보호자"],
  student: ["학생용", "학생"],
  staff: ["교직원용", "교직원", "직원용", "직원"]
};

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^0-9a-zA-Z가-힣]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function scoreItem(text: string, tokenFreq: Map<string, number>): number {
  const seen = new Set<string>();
  let score = 0;
  for (const token of tokenize(text)) {
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    score += tokenFreq.get(token) ?? 0;
  }
  return score;
}

function tokenizeWithFrequency(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokenize(text)) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  return freq;
}

function buildRecommendations(audience: Audience, tokenFreq: Map<string, number>, limit = 15): RecommendationItem[] {
  const candidates = questionBank.filter((item) => item.audience === audience);
  return candidates
    .map((item) => {
      const joined = `${item.area} ${item.subarea} ${item.indicator} ${item.question}`;
      return {
        id: item.id,
        audience: item.audience,
        indicator: item.indicator,
        question: item.question,
        area: item.area,
        subarea: item.subarea,
        score: scoreItem(joined, tokenFreq)
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function detectAudienceSections(text: string): Partial<Record<Audience, string>> {
  const lower = text.toLowerCase();
  const points: Array<{ audience: Audience; index: number }> = [];
  for (const audience of AUDIENCES) {
    const marker = AUDIENCE_HEADERS[audience]
      .map((name) => lower.indexOf(name.toLowerCase()))
      .filter((idx) => idx >= 0)
      .sort((a, b) => a - b)[0];
    if (marker !== undefined) {
      points.push({ audience, index: marker });
    }
  }
  points.sort((a, b) => a.index - b.index);

  const sections: Partial<Record<Audience, string>> = {};
  for (let i = 0; i < points.length; i++) {
    const start = points[i].index;
    const end = i + 1 < points.length ? points[i + 1].index : text.length;
    sections[points[i].audience] = text.slice(start, end);
  }
  return sections;
}

export async function POST(request: Request) {
  const session = await requireSchoolSession();
  if ("status" in session) {
    return session;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const audienceRaw = String(formData.get("audience") ?? "teacher") as Audience;
    const audience: Audience = AUDIENCES.includes(audienceRaw) ? audienceRaw : "teacher";
    const mode = String(formData.get("mode") ?? "single");

    if (!(file instanceof File)) {
      return jsonError("PDF 파일이 필요합니다.");
    }
    if (file.type !== "application/pdf") {
      return jsonError("PDF 파일만 업로드할 수 있습니다.");
    }

    const arrayBuffer = await file.arrayBuffer();
    const parser = new PDFParse({ data: Buffer.from(arrayBuffer) });
    const parsed = await parser.getText();
    const text = parsed.text.trim();
    await parser.destroy();
    if (!text) {
      return jsonError("PDF에서 텍스트를 추출하지 못했습니다.");
    }

    const tokenFreq = tokenizeWithFrequency(text);

    const topKeywords = Array.from(tokenFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([token]) => token);

    if (mode === "autofill") {
      const sections = detectAudienceSections(text);
      const byAudience: Partial<Record<Audience, RecommendationItem[]>> = {};
      for (const audienceKey of AUDIENCES) {
        const sectionText = sections[audienceKey] ?? text;
        const sectionFreq = tokenizeWithFrequency(sectionText);
        byAudience[audienceKey] = buildRecommendations(audienceKey, sectionFreq, 12);
      }
      return jsonOk({
        mode: "autofill",
        byAudience,
        detectedSections: Object.keys(sections),
        keywords: topKeywords,
        sourceLength: text.length
      });
    }

    return jsonOk({
      mode: "single",
      audience,
      recommendations: buildRecommendations(audience, tokenFreq),
      keywords: topKeywords,
      sourceLength: text.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF 추천 분석에 실패했습니다.";
    return jsonError(message, 500);
  }
}
