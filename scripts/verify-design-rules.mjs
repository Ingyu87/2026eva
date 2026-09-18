/**
 * 디자인 규칙 자동 검사 — docs/design.md 10장
 *
 * 사용법: node scripts/verify-design-rules.mjs
 *
 * 화면이 조잡해 보이는 원인은 대개 아래 셋입니다.
 *   1. 목록에 없는 색을 썼다
 *   2. 간격이 4의 배수가 아니다
 *   3. 높이를 픽셀로 고정했다 (24인치에서 화면 아래가 비는데 카드 안에서 스크롤함)
 *
 * 사람이 매번 눈으로 잡기 어려우므로 기계가 잡습니다.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = ["app/globals.css", "app/styles/tokens.css"];

let failures = 0;
let checks = 0;

function ok(message) {
  checks += 1;
  console.log(`  [PASS] ${message}`);
}

function ng(message, detail) {
  checks += 1;
  failures += 1;
  console.log(`  [FAIL] ${message}`);
  if (detail) {
    for (const line of detail.slice(0, 8)) {
      console.log(`         ${line}`);
    }
  }
}

/** 토큰 정의부는 값을 정하는 곳이므로 검사 대상에서 뺍니다. */
function bodyOf(css) {
  const start = css.indexOf("/* 가변 글꼴");
  return start >= 0 ? css.slice(start) : css;
}

const globals = readFileSync(join(root, files[0]), "utf8");
const tokens = readFileSync(join(root, files[1]), "utf8");

console.log("== 1. 높이를 픽셀로 고정한 곳이 없는가 ==");
{
  const offenders = [];
  for (const [name, css] of [
    ["globals.css", globals],
    ["tokens.css", bodyOf(tokens)]
  ]) {
    const re = /(max-height|min-height|height)\s*:\s*(\d{3,})px/g;
    let match;
    while ((match = re.exec(css))) {
      const line = css.slice(0, match.index).split("\n").length;
      offenders.push(`${name}:${line}  ${match[0]}`);
    }
  }
  if (offenders.length === 0) {
    ok("세 자리 픽셀 높이 고정 없음");
  } else {
    ng("높이가 픽셀로 고정된 곳이 있습니다", offenders);
  }
}

console.log("\n== 2. 작업 화면이 페이지 스크롤을 막는가 ==");
{
  const rootBlock = globals.match(/\.ws-root\s*\{[^}]*\}/)?.[0] ?? "";
  if (/height:\s*100dvh/.test(rootBlock) && /overflow:\s*hidden/.test(rootBlock)) {
    ok(".ws-root 가 100dvh + overflow:hidden");
  } else {
    ng(".ws-root 에 100dvh 또는 overflow:hidden 이 없습니다", [rootBlock.slice(0, 120)]);
  }

  const bodyBlock = globals.match(/\.ws-col-body\s*\{[^}]*\}/)?.[0] ?? "";
  if (/min-height:\s*0/.test(bodyBlock) && /overflow-y:\s*auto/.test(bodyBlock)) {
    ok(".ws-col-body 가 min-height:0 + overflow-y:auto (열만 스크롤)");
  } else {
    ng(".ws-col-body 설정이 부족합니다", [bodyBlock.slice(0, 120)]);
  }
}

console.log("\n== 3. 간격이 4의 배수인가 ==");
{
  const offenders = [];
  const re = /(?:padding|margin|gap|top|bottom|left|right)(?:-[a-z]+)?\s*:\s*([^;{}]+);/g;
  let match;
  while ((match = re.exec(globals))) {
    for (const value of match[1].matchAll(/(\d+)px/g)) {
      const px = Number(value[1]);
      if (px % 4 !== 0 && px !== 1 && px !== 2 && px !== 3 && px !== 6) {
        const line = globals.slice(0, match.index).split("\n").length;
        offenders.push(`globals.css:${line}  ${match[0].trim()}`);
      }
    }
  }
  if (offenders.length === 0) {
    ok("간격 값이 모두 4의 배수 (또는 1~3px 헤어라인, 6px 반칸)");
  } else {
    ng("4의 배수가 아닌 간격이 있습니다", offenders);
  }
}

console.log("\n== 4. 목록에 없는 색을 쓰지 않았는가 ==");
{
  const declared = new Set(
    Array.from(tokens.matchAll(/(#[0-9a-fA-F]{3,8})/g)).map((m) => m[1].toLowerCase())
  );
  const offenders = [];
  for (const match of bodyOf(globals).matchAll(/#[0-9a-fA-F]{3,8}/g)) {
    const hex = match[0].toLowerCase();
    if (!declared.has(hex)) {
      const line = globals.slice(0, match.index).split("\n").length;
      offenders.push(`globals.css:${line}  ${hex}`);
    }
  }
  if (offenders.length === 0) {
    ok("globals.css 가 토큰에 없는 색을 쓰지 않음");
  } else {
    ng("토큰에 없는 색이 있습니다. tokens.css 에 먼저 추가하세요", offenders);
  }
}

console.log("\n== 5. 강조색이 하나인가 ==");
{
  // 상태 색(초록·주황·빨강·파랑)은 상태 표시 전용이라 셈에서 뺍니다.
  const accents = new Set();
  for (const match of bodyOf(globals).matchAll(/var\(--(brand-\d{3})\)/g)) {
    accents.add(match[1]);
  }
  const families = new Set(Array.from(accents).map(() => "brand"));
  if (families.size <= 1) {
    ok(`강조색이 남보라 한 계열 (${accents.size}단계 사용)`);
  } else {
    ng("강조색 계열이 둘 이상입니다", Array.from(families));
  }
}

console.log("\n========================================");
console.log(`  통과 ${checks - failures} / 실패 ${failures}`);
console.log("========================================");

process.exit(failures === 0 ? 0 : 1);
