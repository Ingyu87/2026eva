/**
 * 점수 계산 검증 — docs/implementation.md 6단계, spec.md 10.1
 *
 *   node scripts/verify-scoring.mjs
 *
 * `src/lib/scoring.ts`는 앱에서 그대로 쓰는 TypeScript 모듈이라 이 스크립트는
 * TypeScript를 변환하여 실제 구현을 실행합니다.
 * 기대값은 가이드북 예시와 경계값으로 독립 검증합니다.
 *
 * 가이드북 p.51: "점수 계산은 AI가 아니라 프로그램이 합니다." 여기서 흔히 틀리는 지점은
 * (1) 라벨이 아니라 인덱스로 점수를 매기는 것, (2) 영역 평균을 문항 평균들의 단순평균으로 구하는 것,
 * (3) 4단계 판정을 반올림한 값으로 매겨 경계에서 한 단계 높게 나오는 것입니다.
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('./load-ts.cjs');
const { scoreForLabel, buildDistribution, distributionCount, weightedMean, roundToOneDecimal, gradeForMean } = require('../src/lib/scoring.ts');

let pass = 0;
let fail = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}${ok ? "" : ` — 기대 ${JSON.stringify(expected)}, 실제 ${JSON.stringify(actual)}`}`);
  if (ok) pass += 1;
  else fail += 1;
}

console.log("== 1. 라벨 → 점수 매핑 (뒤집힘 방지) ==");
check('"매우 그렇다" = 5', scoreForLabel("매우 그렇다"), 5);
check('"그렇다" = 4', scoreForLabel("그렇다"), 4);
check('"보통이다" = 3', scoreForLabel("보통이다"), 3);
check('"그렇지 않다" = 2', scoreForLabel("그렇지 않다"), 2);
check('"전혀 그렇지 않다" = 1', scoreForLabel("전혀 그렇지 않다"), 1);
check("척도 라벨이 아니면 null", scoreForLabel("서술형 응답"), null);

console.log("\n== 2. 가이드북 51쪽 예시 ==");
{
  // 5점 113명, 4점 35명, 3점 16명, 2점 7명, 1점 4명 (합 175)
  const distribution = [113, 35, 16, 7, 4];
  const mean = weightedMean(distribution);
  check("합계 771/175 = 4.405714...", Math.round(mean * 1e6) / 1e6, 4.405714);
  check("반올림 → 4.4", roundToOneDecimal(mean), 4.4);
  check("판정 → 매우 우수", gradeForMean(mean), "매우 우수");
}

console.log("\n== 3. 4단계 경계값 (반올림 전 원값으로 판정) ==");
check("3.999 → 우수", gradeForMean(3.999), "우수");
check("3.9999999 → 우수", gradeForMean(3.9999999), "우수");
check("4.0 → 매우 우수", gradeForMean(4.0), "매우 우수");
check("2.999 → 보통", gradeForMean(2.999), "보통");
check("3.0 → 우수", gradeForMean(3.0), "우수");
check("1.999 → 미흡", gradeForMean(1.999), "미흡");
check("2.0 → 보통", gradeForMean(2.0), "보통");

console.log("\n== 4. 영역 평균은 문항 평균들의 단순평균이 아니다 ==");
{
  // 문항A: 응답 10명, 평균 5.0 / 문항B: 응답 100명, 평균 1.0
  const distA = buildDistribution(Array(10).fill("매우 그렇다"));
  const distB = buildDistribution(Array(100).fill("전혀 그렇지 않다"));
  const meanA = weightedMean(distA);
  const meanB = weightedMean(distB);
  const simpleAverage = (meanA + meanB) / 2; // 틀린 계산: 3.0

  const areaSubtotal = [distA[0] + distB[0], distA[1] + distB[1], distA[2] + distB[2], distA[3] + distB[3], distA[4] + distB[4]];
  const areaMean = weightedMean(areaSubtotal); // 맞는 계산: (10*5 + 100*1) / 110 = 150/110 = 1.3636...

  check("문항 평균의 단순평균(3.0)과 다르다", areaMean !== simpleAverage, true);
  check("영역 가중평균 ≈ 1.3636", Math.round(areaMean * 1e4) / 1e4, 1.3636);
}

console.log("\n== 5. 무효 응답 처리 ==");
{
  const distribution = buildDistribution(["매우 그렇다", "잘 모름", "", "그렇다"]);
  check("척도 라벨 아닌 응답은 분포에서 제외", distributionCount(distribution), 2);
}

console.log("\n========================================");
console.log(`  통과 ${pass} / 실패 ${fail}`);
console.log("========================================");

if (fail > 0) {
  process.exit(1);
}
