/**
 * 2026 문항 풀 검증 — docs/implementation.md 3단계
 *
 *   node scripts/verify-question-bank.mjs
 *
 * 영역·세부영역은 학교가 고칠 수 없는 값입니다(기본계획 Ⅴ-3-가-2, 가이드북 Q6).
 * 잘못된 값이 하나라도 섞이면 제출 서식에 매핑되지 않으므로 기계가 확인합니다.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** evaluationFramework.ts 와 같은 값. 여기서 다시 적어 두 곳이 어긋나면 잡히게 합니다. */
const SUBAREAS_2026 = [
  "Ⅰ-1. 소통과 협력의 학교자치",
  "Ⅰ-2. 학부모 및 지역사회 연계",
  "Ⅰ-3. 공감과 소통의 행정",
  "Ⅱ-1. 교육과정 편성·운영",
  "Ⅱ-2. 수업·평가 혁신",
  "Ⅱ-3. 교원 전문성 신장",
  "Ⅲ-1. 모두를 위한 맞춤형 교육",
  "Ⅲ-2. 미래역량 교육",
  "Ⅲ-3. 안전하고 행복한 학교",
  "Ⅲ-4. 기타(학교 유형, 특성에 따른 세부영역)"
];

/** 2025 체계. 하나라도 남아 있으면 안 됩니다. */
const SUBAREAS_2025 = [
  "Ⅰ-1. 소통과 협력의 학교자치 기반 조성",
  "Ⅰ-3. 행정·예산",
  "Ⅲ-1. 맞춤형 책임교육",
  "Ⅲ-2. 인문·과학·예체능교육",
  "Ⅲ-3. 민주시민교육",
  "Ⅲ-4. 안전하고 쾌적한 교육환경",
  "Ⅲ-5. 기타"
];

let failures = 0;
let checks = 0;
const ok = (m) => (checks++, console.log(`  [PASS] ${m}`));
const ng = (m, detail = []) => {
  checks++;
  failures++;
  console.log(`  [FAIL] ${m}`);
  detail.slice(0, 8).forEach((d) => console.log(`         ${d}`));
};

const bank = JSON.parse(readFileSync(join(root, "src/data/question-bank-2026.json"), "utf8"));
const framework = readFileSync(join(root, "src/lib/evaluationFramework.ts"), "utf8");
const items = bank.items ?? [];

console.log("== 1. 문항 풀이 실려 있는가 ==");
items.length > 0
  ? ok(`문항 ${items.length}개 (${bank.year}학년도 · ${bank.schoolLevel})`)
  : ng("문항 풀이 비어 있습니다");

console.log("\n== 2. 세부영역이 모두 2026 체계인가 ==");
{
  const allowed = new Set(SUBAREAS_2026);
  const bad = items.filter((i) => !allowed.has(i.subarea));
  bad.length === 0
    ? ok("허용 목록 밖의 세부영역 없음")
    : ng(
        `허용되지 않은 세부영역 ${bad.length}건`,
        [...new Set(bad.map((i) => i.subarea))]
      );
}

console.log("\n== 3. 2025 분류가 남아 있지 않은가 ==");
{
  const legacy = new Set(SUBAREAS_2025);
  const bad = items.filter((i) => legacy.has(i.subarea));
  bad.length === 0
    ? ok("2025 세부영역 0건")
    : ng(`2025 세부영역이 남아 있습니다 (${bad.length}건)`, [
        ...new Set(bad.map((i) => i.subarea))
      ]);
}

console.log("\n== 4. 영역과 세부영역이 서로 맞는가 ==");
{
  const bad = items.filter((i) => !i.subarea.startsWith(i.area.split(".")[0]));
  bad.length === 0
    ? ok("모든 문항의 영역·세부영역 번호가 일치")
    : ng(`영역과 세부영역이 어긋난 문항 ${bad.length}건`, bad.slice(0, 5).map((i) => `${i.id} ${i.area} / ${i.subarea}`));
}

console.log("\n== 5. 평가주체 구분이 들어 있지 않은가 ==");
{
  // 2026 예시자료에는 주체 구분이 없습니다. 주체는 학교가 담을 때 지정합니다.
  const bad = items.filter((i) => "audience" in i);
  bad.length === 0
    ? ok("문항 풀에 audience 필드 없음 (주체는 담을 때 지정)")
    : ng(`audience 필드가 남아 있는 문항 ${bad.length}건`);
}

console.log("\n== 6. 필수 항목이 비어 있지 않은가 ==");
{
  const bad = items.filter((i) => !i.id || !i.area || !i.subarea || !i.indicator || !i.question);
  const dupes = items.length - new Set(items.map((i) => i.id)).size;
  bad.length === 0 ? ok("빈 항목 없음") : ng(`빈 항목이 있는 문항 ${bad.length}건`);
  dupes === 0 ? ok("id 중복 없음") : ng(`id가 중복된 문항 ${dupes}건`);
}

console.log("\n== 7. 코드의 기준값과 어긋나지 않는가 ==");
{
  const missing = SUBAREAS_2026.filter((s) => !framework.includes(s));
  missing.length === 0
    ? ok("evaluationFramework.ts 가 같은 세부영역 10개를 정의")
    : ng("evaluationFramework.ts 에 빠진 세부영역", missing);
}

console.log("\n== 세부영역별 문항 수 ==");
for (const subarea of SUBAREAS_2026) {
  const n = items.filter((i) => i.subarea === subarea).length;
  // Ⅲ-4 기타는 자율고·특목고·특성화고·특수학교 전용이라 초등은 0이 정상입니다.
  const note = n === 0 && subarea.startsWith("Ⅲ-4") ? "  (초등 해당 없음 — 정상)" : "";
  console.log(`   ${subarea.padEnd(34)} ${String(n).padStart(3)}${note}`);
}

console.log("\n========================================");
console.log(`  통과 ${checks - failures} / 실패 ${failures}`);
console.log("========================================");
process.exit(failures === 0 ? 0 : 1);
