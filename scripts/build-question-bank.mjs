/**
 * 원본 추출 JSON을 앱이 쓰는 문항 풀로 정리합니다.
 *
 *   node scripts/build-question-bank.mjs .parsed/question-bank-2026-raw.json
 *
 * PDF에서 표를 뽑으면 반드시 쓰레기가 섞입니다. 실제로 2026 초등 예시자료에서
 * 페이지 경계에 걸린 유령 행 4개와 띄어쓰기가 다른 세부영역이 확인되었습니다.
 * 잘못된 세부영역이 하나라도 섞이면 제출 서식에 매핑되지 않으므로,
 * 허용 목록과 대조해 통과한 것만 문항 풀에 넣고 나머지는 따로 모아 보고합니다.
 *
 * 추출 방법이 로컬 파싱이든 Upstage든 이 스크립트는 그대로 씁니다.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 2026 세부영역. 법령과 교육청 정책으로 정해져 학교가 수정할 수 없습니다.
 * (기본계획 Ⅴ-3-가-2, 가이드북 Q6)
 */
const SUBAREAS = [
  ["Ⅰ. 협력적 학교자치문화", "Ⅰ-1. 소통과 협력의 학교자치"],
  ["Ⅰ. 협력적 학교자치문화", "Ⅰ-2. 학부모 및 지역사회 연계"],
  ["Ⅰ. 협력적 학교자치문화", "Ⅰ-3. 공감과 소통의 행정"],
  ["Ⅱ. 교육과정 운영 및 교수·학습 방법", "Ⅱ-1. 교육과정 편성·운영"],
  ["Ⅱ. 교육과정 운영 및 교수·학습 방법", "Ⅱ-2. 수업·평가 혁신"],
  ["Ⅱ. 교육과정 운영 및 교수·학습 방법", "Ⅱ-3. 교원 전문성 신장"],
  ["Ⅲ. 교육 활동 및 교육 성과", "Ⅲ-1. 모두를 위한 맞춤형 교육"],
  ["Ⅲ. 교육 활동 및 교육 성과", "Ⅲ-2. 미래역량 교육"],
  ["Ⅲ. 교육 활동 및 교육 성과", "Ⅲ-3. 안전하고 행복한 학교"],
  ["Ⅲ. 교육 활동 및 교육 성과", "Ⅲ-4. 기타(학교 유형, 특성에 따른 세부영역)"]
];

/** 비교할 때만 쓰는 형태로 줄입니다. 중점·공백·괄호 표기가 자료마다 다릅니다. */
function fold(value) {
  return value
    .replace(/[·･・‧∙•]/g, "·")
    .replace(/[（）]/g, (m) => (m === "（" ? "(" : ")"))
    .replace(/\s+/g, "")
    .trim();
}

const SUBAREA_BY_KEY = new Map(
  SUBAREAS.map(([area, subarea]) => [fold(subarea), { area, subarea }])
);

/** `Ⅲ-2.` 처럼 번호만 맞고 이름이 깨진 행을 살릴 때 씁니다. */
const SUBAREA_BY_NAME = new Map(
  SUBAREAS.map(([area, subarea]) => [fold(subarea.replace(/^[^.]+\.\s*/, "")), { area, subarea }])
);

function normalizeText(value) {
  return value.replace(/\s+/g, " ").replace(/[·･・‧∙•]/g, "·").trim();
}

function main() {
  const rawPath = process.argv[2];
  if (!rawPath) {
    console.error("사용법: node scripts/build-question-bank.mjs <원본 JSON 경로>");
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(join(root, rawPath), "utf8"));
  const { year = 2026, schoolLevel = "elementary", rows = [] } = raw;

  const items = [];
  const rejected = [];
  const seen = new Set();
  let serial = 0;

  for (const row of rows) {
    const area = normalizeText(row.area ?? "");
    const subareaRaw = normalizeText(row.subarea ?? "");
    const indicator = normalizeText(row.indicator ?? "");
    const question = normalizeText(row.question ?? "");

    if (!question || !indicator) {
      rejected.push({ ...row, reason: "평가지표 또는 문항이 비어 있음" });
      continue;
    }

    // 1) 세부영역 전체가 일치하는 경우
    let matched = SUBAREA_BY_KEY.get(fold(subareaRaw));

    // 2) 번호가 깨졌지만 이름은 맞는 경우 (페이지 경계에서 흔합니다)
    if (!matched) {
      matched = SUBAREA_BY_NAME.get(fold(subareaRaw.replace(/^[^.]+\.\s*/, "")));
    }

    if (!matched) {
      rejected.push({ ...row, reason: `허용되지 않은 세부영역: ${subareaRaw}` });
      continue;
    }

    // 같은 지표의 같은 문항이 페이지 경계에서 두 번 잡히는 일이 있습니다.
    const key = `${matched.subarea}|${indicator}|${question}`;
    if (seen.has(key)) {
      rejected.push({ ...row, reason: "중복" });
      continue;
    }
    seen.add(key);

    serial += 1;
    items.push({
      id: `${schoolLevel === "elementary" ? "el" : schoolLevel}-${year}-${String(serial).padStart(4, "0")}`,
      year,
      schoolLevel,
      area: matched.area,
      subarea: matched.subarea,
      indicator,
      question,
      sourceRow: serial
    });

    if (area && fold(area) !== fold(matched.area)) {
      // 영역은 세부영역에서 되살릴 수 있으므로 버리지 않고 알리기만 합니다.
      rejected.push({
        ...row,
        reason: `영역 표기 불일치(세부영역 기준으로 보정): ${area} -> ${matched.area}`,
        recovered: true
      });
    }
  }

  const outDir = join(root, "src/data");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, `question-bank-${year}.json`),
    `${JSON.stringify({ year, schoolLevel, items }, null, 2)}\n`,
    "utf8"
  );

  // 버려진 행은 사람이 확인해야 하므로 따로 남깁니다.
  mkdirSync(join(root, ".parsed"), { recursive: true });
  writeFileSync(
    join(root, ".parsed", `question-bank-${year}-rejected.json`),
    `${JSON.stringify(rejected, null, 2)}\n`,
    "utf8"
  );

  const bySubarea = new Map();
  for (const item of items) {
    bySubarea.set(item.subarea, (bySubarea.get(item.subarea) ?? 0) + 1);
  }

  console.log(`\n채택 ${items.length}행 / 제외 ${rejected.filter((r) => !r.recovered).length}행`);
  console.log("─".repeat(52));
  for (const [, subarea] of SUBAREAS) {
    const count = bySubarea.get(subarea) ?? 0;
    console.log(`${count === 0 ? "  !" : "   "} ${subarea.padEnd(34)} ${String(count).padStart(3)}`);
  }
  console.log("─".repeat(52));
  console.log(`-> src/data/question-bank-${year}.json`);

  const hard = rejected.filter((r) => !r.recovered);
  if (hard.length > 0) {
    console.log(`\n확인이 필요한 행 ${hard.length}개 (.parsed/question-bank-${year}-rejected.json):`);
    for (const row of hard.slice(0, 10)) {
      console.log(`  p.${row.page ?? "?"}  ${row.reason}`);
    }
  }
}

main();
