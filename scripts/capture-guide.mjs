/**
 * 도움말 그림과 OG 이미지를 실제 화면에서 다시 뽑습니다.
 *
 * 화면이 바뀌면 손으로 그린 그림은 금방 어긋납니다. 이 스크립트는 개발 서버를 띄워 둔 상태에서
 * 샘플 학교("예시초등학교")를 만들고, 연구부장·부장 두 역할로 들어가 필요한 부분만 잘라 저장합니다.
 *
 *   npm run dev            # 다른 터미널에서 (기본 http://localhost:3000)
 *   npm run guide:capture
 *
 * 환경변수: BASE_URL(기본 http://localhost:3000), BROWSER_PATH(Chrome/Edge 실행 파일).
 * 저장소(Firebase)가 연결된 서버에는 샘플 학교가 실제로 만들어지므로, 로컬 메모리 저장소에서만 돌리세요.
 */
import { existsSync, mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "public/guide";
const SCHOOL = "예시초등학교";
const PASSWORD = "guide-1234";

const BROWSER =
  process.env.BROWSER_PATH ??
  [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ].find((path) => existsSync(path));

if (!BROWSER) {
  console.error("Chrome 또는 Edge를 찾지 못했습니다. BROWSER_PATH를 지정하세요.");
  process.exit(1);
}
if (!BASE.startsWith("http://localhost") && !BASE.startsWith("http://127.0.0.1")) {
  console.error("안전을 위해 로컬 서버(localhost)에서만 실행합니다.");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  executablePath: BROWSER,
  headless: "new",
  args: ["--no-sandbox"],
  defaultViewport: { width: 1440, height: 820, deviceScaleFactor: 2 }
});

async function newPage() {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  // Next 개발 서버의 "N" 배지가 그림에 찍히지 않게 숨깁니다.
  await page.evaluateOnNewDocument(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
    });
  });
  return page;
}

async function clickText(page, text, selector = "button") {
  for (const handle of await page.$$(selector)) {
    const label = (await handle.evaluate((el) => el.textContent ?? "")).trim();
    if (label === text || label.includes(text)) {
      await handle.click();
      return true;
    }
  }
  throw new Error(`"${text}" 버튼을 찾지 못했습니다 (${selector}).`);
}

/** 화면 안에서 요소를 찾아 강조 표시를 붙입니다. selector 또는 {selector, text}. */
async function highlight(page, targets) {
  await page.evaluate((list) => {
    document.querySelectorAll(".__hl").forEach((el) => el.classList.remove("__hl"));
    if (!document.getElementById("__hl-style")) {
      const style = document.createElement("style");
      style.id = "__hl-style";
      style.textContent =
        ".__hl{outline:3px solid #4341C4!important;outline-offset:3px;border-radius:10px;box-shadow:0 0 0 8px rgba(67,65,196,.16)!important}";
      document.head.appendChild(style);
    }
    for (const target of list) {
      const { selector, text, nth = 0 } = typeof target === "string" ? { selector: target } : target;
      let found = [...document.querySelectorAll(selector)];
      if (text) {
        found = found.filter((el) => (el.textContent ?? "").trim().includes(text));
      }
      found[nth]?.classList.add("__hl");
    }
  }, targets);
}

async function clearHighlight(page) {
  await page.evaluate(() => document.querySelectorAll(".__hl").forEach((el) => el.classList.remove("__hl")));
}

/** 여러 요소를 모두 포함하는 사각형(여백 포함)을 구합니다. */
async function unionRect(page, selectors, pad = 16) {
  const rect = await page.evaluate(
    (list, margin) => {
      const boxes = list
        .map((selector) => document.querySelector(selector)?.getBoundingClientRect())
        .filter(Boolean);
      if (boxes.length === 0) {
        return null;
      }
      const left = Math.min(...boxes.map((box) => box.left)) - margin;
      const top = Math.min(...boxes.map((box) => box.top)) - margin;
      const right = Math.max(...boxes.map((box) => box.right)) + margin;
      const bottom = Math.max(...boxes.map((box) => box.bottom)) + margin;
      return { x: Math.max(0, left), y: Math.max(0, top), width: right - Math.max(0, left), height: bottom - Math.max(0, top) };
    },
    selectors,
    pad
  );
  if (!rect) {
    throw new Error(`영역을 찾지 못했습니다: ${selectors.join(", ")}`);
  }
  return rect;
}

async function shot(page, name, clip) {
  await sleep(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, clip });
  console.log("저장", `${OUT}/${name}.png`);
}

async function api(page, path, body, method = "POST") {
  return page.evaluate(
    async (url, payload, verb) => {
      const response = await fetch(url, {
        method: verb,
        headers: { "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload)
      });
      return response.json();
    },
    path,
    body,
    method
  );
}

const seed = (id, audience, subarea, indicator, text) => ({
  id,
  sourceQuestionId: `seed-${id}`,
  groupId: `seed-${id}`,
  audience,
  sourceRow: 1,
  area: "",
  subarea,
  indicator,
  originalQuestion: text,
  editedQuestion: text,
  responseType: "likert5",
  order: Number(id.replace(/\D/g, "")) || 1
});

/* ------------------------------------------------------------------ 연구부장 */

const lead = await newPage();
await lead.goto(BASE, { waitUntil: "networkidle0" });
await clickText(lead, "새 학교 등록");
let inputs = await lead.$$("input");
await inputs[0].type(SCHOOL);
await inputs[1].type(PASSWORD);
await clickText(lead, "등록하기");
const registered = await lead.waitForSelector(".ws-topbar", { timeout: 20000 }).catch(() => null);
if (!registered) {
  // 이미 있는 학교면 로그인합니다.
  await clickText(lead, "기존 학교 로그인");
  inputs = await lead.$$("input");
  await inputs[0].click({ clickCount: 3 });
  await inputs[0].type(SCHOOL);
  await inputs[1].type(PASSWORD);
  await clickText(lead, "로그인");
}
await lead.waitForSelector(".ws-topbar");
await sleep(800);

// "누구신가요?" → 이름 입력, 시작 안내 카드 닫기
if (await lead.$(".conflict-input")) {
  await lead.type(".conflict-input", "연구부장");
  await clickText(lead, "시작하기", ".conflict-actions button");
  await sleep(600);
}
if (await lead.$(".conflict-dialog")) {
  await clickText(lead, "시작하기", ".conflict-actions button");
  await sleep(400);
}

const leadItems = [
  seed("1", "teacher", "Ⅰ-1. 소통과 협력의 학교자치", "학교 비전 공유 및 실현", "학교 구성원의 소통과 협력을 바탕으로 학교 비전을 공유하고 있다."),
  seed("2", "teacher", "Ⅰ-1. 소통과 협력의 학교자치", "학교 비전 공유 및 실현", "학교 교육계획 수립에 교직원의 의견이 반영된다.")
];
await api(lead, "/api/draft/items", { items: leadItems, updatedBy: "연구부장" });

// 부장 링크 3개
const links = {};
for (const [label, audience] of [["교무부장", "teacher"], ["학생부장", "student"], ["보건교사", undefined]]) {
  const result = await api(lead, "/api/invite", { label, audience });
  links[label] = `${BASE}/?invite=${result.data.invite.token}`;
}

/** 부장 화면을 열고 시작 안내를 닫습니다. */
async function openBuilder(url) {
  const page = await newPage();
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.waitForSelector(".conflict-dialog");
  await clickText(page, "시작하기", ".conflict-actions button");
  await page.waitForSelector(".ws-topbar");
  await sleep(600);
  return page;
}

/** 첫 카드부터 n개에 교원 칩을 눌러 담습니다. */
async function addByChips(page, count, chipText, start = 0) {
  for (let index = start; index < start + count; index += 1) {
    await page.evaluate(
      (i, text) => {
        const card = document.querySelectorAll(".ws-card")[i];
        const chip = [...card.querySelectorAll(".ws-aud-chip")].find((el) => el.textContent.trim() === text);
        chip?.click();
      },
      index,
      chipText
    );
    await sleep(700);
  }
}

// 교무부장: 2개 담고 제출 / 학생부장: 1개만 담고 작성 중으로 둠
const b1 = await openBuilder(links["교무부장"]);
await addByChips(b1, 2, "교원");
await sleep(800);
await clickText(b1, "제출", ".ws-topbar-right button");
await sleep(800);

const b2 = await openBuilder(links["학생부장"]);
await addByChips(b2, 1, "학생");

// 화면에 보이는 부장(보건교사): 전체 대상, 문항은 아직 없음
const b3 = await openBuilder(links["보건교사"]);

/* ------------------------------------------------------------------ 연구부장 캡처 */

await lead.reload({ waitUntil: "networkidle0" });
await lead.waitForSelector(".ws-topbar");
await sleep(1500); // 부장 작업 n/m 을 받아 오는 시간

// 모드
await highlight(lead, [".ws-mode"]);
await shot(lead, "lead-mode", await unionRect(lead, [".ws-school", ".ws-mode"], 12));

// 찾기
await highlight(lead, [".ws-search", ".ws-tree .ws-col-body"]);
await shot(lead, "lead-find", await unionRect(lead, [".ws-audience-tabs", ".ws-tree", ".ws-finder"], 0));

// 담기 (학부모 칩)
await lead.evaluate(() => {
  const card = document.querySelectorAll(".ws-card")[2];
  [...card.querySelectorAll(".ws-aud-chip")].find((el) => el.textContent.trim() === "학부모")?.click();
});
await sleep(900);
await highlight(lead, [{ selector: ".ws-card .ws-aud-chips", nth: 2 }]);
await shot(lead, "lead-add", await unionRect(lead, [".ws-audience-tabs", ".ws-finder"], 0));
// 되돌림
await lead.evaluate(() => {
  const card = document.querySelectorAll(".ws-card")[2];
  [...card.querySelectorAll(".ws-aud-chip")].find((el) => el.textContent.trim() === "학부모")?.click();
});
await sleep(600);

// 고치기
await lead.evaluate(() => document.querySelector(".ws-item-actions button[aria-label='수정']")?.click());
await sleep(600);
await highlight(lead, [".ws-item.is-editing .ws-textarea"]);
await shot(lead, "lead-edit", await unionRect(lead, [".ws-selected"], 0));
await lead.evaluate(() => document.querySelector(".ws-item.is-editing button.ws-btn--primary")?.click());
await sleep(500);

// 영역 커버리지
await highlight(lead, [".ws-coverage"]);
await shot(lead, "lead-coverage", await unionRect(lead, [".ws-selected .ws-col-foot"], 0));
await clearHighlight(lead);

// 부장 작업 (상단 버튼 + 설정 창)
await highlight(lead, [{ selector: ".ws-topbar-right .ws-btn--soft", text: "부장 작업" }]);
await lead.evaluate(() => [...document.querySelectorAll(".ws-topbar-right button")].find((el) => el.textContent.includes("부장 작업"))?.click());
await lead.waitForSelector(".ws-modal");
await sleep(1200);
await highlight(lead, [
  ".ws-invite-summary",
  { selector: ".ws-invite-state", nth: 0 },
  { selector: ".ws-invite-state", nth: 1 },
  { selector: ".ws-invite-state", nth: 2 }
]);
const modalBox = await unionRect(lead, [".ws-modal"], 8);
const listBox = await unionRect(lead, [".ws-invite-list"], 24);
await shot(lead, "lead-invite", {
  x: modalBox.x,
  y: modalBox.y,
  width: modalBox.width,
  height: listBox.y + listBox.height - modalBox.y
});
await lead.keyboard.press("Escape");
await sleep(400);

// 내보내기 버튼
await highlight(lead, [
  { selector: ".ws-topbar-right .ws-btn--ghost", text: "설문지" },
  { selector: ".ws-topbar-right .ws-btn--primary", text: "Google Forms" }
]);
await shot(lead, "lead-export", await unionRect(lead, [".ws-topbar-right"], 12));

// 결과 분석
await clickText(lead, "결과 분석 · 내보내기", ".ws-screen-tab");
await sleep(1200);
await highlight(lead, [{ selector: ".ws-screen-tab.is-active" }]);
await shot(lead, "lead-analyze", { x: 0, y: 0, width: 1440, height: 400 });
await clickText(lead, "문항 구성", ".ws-screen-tab");
await clearHighlight(lead);
await sleep(600);

// OG용 연구부장 전체 화면 (강조 없이)
const leadFull = await lead.screenshot({ encoding: "base64" });

/* ------------------------------------------------------------------ 부장 캡처 */

// 보건교사 화면에서: 위쪽 → 찾기 → 담기 → 내 문항과 남의 문항 → 제출
await highlight(b3, [".ws-mode--static"]);
await shot(b3, "builder-enter", await unionRect(b3, [".ws-topbar", ".ws-audience-tabs"], 0));

await highlight(b3, [".ws-search", ".ws-tree .ws-col-body"]);
await shot(b3, "builder-find", await unionRect(b3, [".ws-audience-tabs", ".ws-tree", ".ws-finder"], 0));

await addByChips(b3, 1, "교원", 2);
await highlight(b3, [{ selector: ".ws-card .ws-aud-chips", nth: 2 }]);
await shot(b3, "builder-add", await unionRect(b3, [".ws-audience-tabs", ".ws-finder"], 0));

// 내가 담은 문항(맨 아래)이 잘리지 않게 목록을 끝까지 내립니다.
await b3.evaluate(() => {
  const body = document.querySelector(".ws-selected .ws-col-body");
  if (body) {
    body.scrollTop = body.scrollHeight;
  }
});
await highlight(b3, [{ selector: ".ws-item-owner", nth: 3 }, { selector: ".ws-item-owner", nth: 4 }]);
await shot(b3, "builder-owners", await unionRect(b3, [".ws-selected"], 0));

await highlight(b3, [{ selector: ".ws-topbar-right .ws-btn--primary", text: "제출" }]);
await shot(b3, "builder-submit", await unionRect(b3, [".ws-topbar-right"], 12));
await clearHighlight(b3);
const builderFull = await b3.screenshot({ encoding: "base64" });

/* ------------------------------------------------------------------ OG 이미지 */

async function renderOg(file, { eyebrow, title, body, image }) {
  const page = await newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="ko"><body style="margin:0;width:1200px;height:630px;overflow:hidden;position:relative;background:#ECEFF8;font-family:Pretendard,'Malgun Gothic',sans-serif;">
    <div style="position:absolute;left:64px;top:72px;width:470px;">
      <div style="display:inline-block;padding:8px 16px;border-radius:999px;background:#E5E4FA;color:#4341C4;font-size:22px;font-weight:700;">${eyebrow}</div>
      <h1 style="margin:28px 0 20px;font-size:56px;line-height:1.25;color:#16161D;letter-spacing:-1px;">${title}</h1>
      <p style="margin:0;font-size:26px;line-height:1.5;color:#4A4E5E;">${body}</p>
    </div>
    <img src="data:image/png;base64,${image}" style="position:absolute;left:580px;top:88px;width:840px;border-radius:20px;box-shadow:0 24px 64px rgba(30,30,80,.22);" />
  </body></html>`);
  await sleep(500);
  await page.screenshot({ path: `public/${file}`, type: "png" });
  console.log("저장", `public/${file}`);
}

await renderOg("og-school-evaluation.png", {
  eyebrow: "학교평가 업무 도우미",
  title: "설문 작성부터<br>학교평가서까지",
  body: "문항을 함께 작성하고, 설문 결과를 분석해 학교평가서를 준비하세요.",
  image: leadFull
});
await renderOg("og-invite.png", {
  eyebrow: "문항 작업 링크",
  title: "문항 작업 링크가<br>도착했습니다",
  body: "연구부장이 보낸 링크입니다. 열면 로그인 없이 문항을 골라 담고, 다 하면 제출을 누르세요.",
  image: builderFull
});

await browser.close();
console.log("완료");
