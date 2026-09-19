/**
 * 설문 결과 보고서 HTML (spec.md 7.2).
 *
 * 단일 파일, 외부 요청 0건. CSS·JS 모두 인라인입니다. 학교 누리집에 그대로 올라가는
 * 파일이라(가이드북 "학교 누리집 탑재") 사용자 입력(학교명·문항·서술형 응답)을 전부
 * `escapeHtml`로 이스케이프합니다 — 안 그러면 저장형 XSS가 됩니다.
 */

import { roundToOneDecimal } from "./scoring";
import {
  AUDIENCES,
  AUDIENCE_SHORT_LABELS,
  needsChoices,
  type Audience,
  type QuestionStat,
  type ResultUpload,
  type SelectedQuestion,
  type SurveyDraft,
  type SurveyResult
} from "./types";

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 서술형 응답 전송·게시 전 개인정보를 가립니다. 7단계 AI 전송용 마스킹과 같은 규칙입니다. */
function maskPersonalInfo(text: string): string {
  return text
    .replace(/01[0-9][-.\s]?\d{3,4}[-.\s]?\d{4}/g, "[전화번호]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[이메일]")
    .replace(/\b\d{8,10}\b/g, "[학번]")
    .replace(
      /[가-힣]{2,4}(?=\s?(선생님|선생|학생|어머니|아버지|학부모님|학부모|담임|교사|교장|교감|원장|부장))/g,
      "[이름]"
    );
}

/** design.md 7.3 점수 색 구분. 원본 결과 보고서 HTML과 동일합니다. */
function scoreClass(mean: number): string {
  if (mean >= 4.5) return "score-high";
  if (mean >= 4.0) return "score-good";
  if (mean >= 3.0) return "score-mid";
  return "";
}

function findStat(stats: QuestionStat[], questionId: string, audience: Audience, grade?: number): QuestionStat | undefined {
  return stats.find((stat) => stat.questionId === questionId && stat.audience === audience && stat.grade === grade);
}

function scoreCell(stat: QuestionStat | undefined): string {
  if (!stat || stat.responseCount === 0) {
    return `<td class="num">-</td>`;
  }
  const mean = roundToOneDecimal(stat.mean);
  return `<td class="num ${scoreClass(mean)}">${mean.toFixed(1)}</td>`;
}

function aiSummaryBox(result: SurveyResult): string {
  const analysis = result.aiAnalysis;
  if (!analysis) {
    return `<div class="ai-box ai-box--empty">AI 해석이 아직 실행되지 않았습니다.</div>`;
  }
  const findings = analysis.areas.flatMap((area) => area.findings);
  const items = findings
    .slice(0, 6)
    .map(
      (finding) =>
        `<li><strong>${escapeHtml(finding.category)}</strong> · ${escapeHtml(finding.subarea)} — ${escapeHtml(finding.content)}</li>`
    )
    .join("");
  return `
    <div class="ai-box">
      <h3>AI 분석 요약</h3>
      <p>${escapeHtml(analysis.overallOpinion)}</p>
      ${items ? `<ul>${items}</ul>` : ""}
    </div>`;
}

function studentGradeColumns(draft: SurveyDraft): number[] {
  return (draft.studentGrades ?? []).slice().sort((a, b) => a - b);
}

/**
 * 같은 예시문항에서 대상별로 복제된 문항(groupId 동일)을 한 행으로 모읍니다.
 * 안 그러면 교원/학부모 등으로 나뉜 같은 질문이 표에 여러 행으로 흩어져 보입니다(spec.md 5.4).
 */
function groupByGroupId(items: SelectedQuestion[]): SelectedQuestion[][] {
  const order: string[] = [];
  const groups = new Map<string, SelectedQuestion[]>();
  for (const item of items) {
    if (!groups.has(item.groupId)) {
      order.push(item.groupId);
      groups.set(item.groupId, []);
    }
    groups.get(item.groupId)!.push(item);
  }
  return order.map((id) => groups.get(id)!);
}

function likertTab(draft: SurveyDraft, items: SelectedQuestion[], result: SurveyResult): string {
  const grades = studentGradeColumns(draft);
  const likertItems = items.filter((item) => item.responseType === "likert_5" && !item.deleted);
  const groups = groupByGroupId(likertItems);

  const headerCols = [
    "문항",
    ...AUDIENCES.filter((a) => a !== "student").map((a) => AUDIENCE_SHORT_LABELS[a]),
    "학생(전체)",
    ...grades.map((g) => `학생 ${g}학년`)
  ];

  const emptyCell = `<td class="num">-</td>`;

  const rows = groups
    .map((group) => {
      const byAudience = new Map(group.map((item) => [item.audience, item]));
      const primary = group[0];
      const label = `<td class="q"><span class="q-meta">${escapeHtml(primary.area)} · ${escapeHtml(primary.subarea)}</span><br/>${escapeHtml(primary.editedQuestion || primary.originalQuestion)}</td>`;

      const nonStudentCells = AUDIENCES.filter((a) => a !== "student")
        .map((a) => {
          const item = byAudience.get(a);
          return item ? scoreCell(findStat(result.questionStats, item.id, a, undefined)) : emptyCell;
        })
        .join("");

      const studentItem = byAudience.get("student");
      const studentOverall = studentItem
        ? scoreCell(findStat(result.questionStats, studentItem.id, "student", undefined))
        : emptyCell;
      const gradeCells = grades
        .map((g) => (studentItem ? scoreCell(findStat(result.questionStats, studentItem.id, "student", g)) : emptyCell))
        .join("");

      return `<tr>${label}${nonStudentCells}${studentOverall}${gradeCells}</tr>`;
    })
    .join("");

  return `
    <section id="tab-likert" class="tab-panel is-active">
      ${aiSummaryBox(result)}
      <table>
        <thead><tr>${headerCols.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows || `<tr><td colSpan="${headerCols.length}" class="empty">5점 척도 문항이 없습니다.</td></tr>`}</tbody>
      </table>
    </section>`;
}

function collectRawAnswers(items: SelectedQuestion[], uploads: ResultUpload[], responseTypeFilter: (item: SelectedQuestion) => boolean) {
  const byItem = new Map<string, { item: SelectedQuestion; answersByAudience: Map<Audience, string[]> }>();
  for (const item of items) {
    if (item.deleted || !responseTypeFilter(item)) continue;
    byItem.set(item.id, { item, answersByAudience: new Map() });
  }

  for (const upload of uploads) {
    upload.mapping.forEach((mapping, colIndex) => {
      const entry = mapping.questionId ? byItem.get(mapping.questionId) : undefined;
      if (!entry) return;
      const answers = upload.rows.map((row) => (row[colIndex] ?? "").trim()).filter(Boolean);
      const existing = entry.answersByAudience.get(upload.audience) ?? [];
      entry.answersByAudience.set(upload.audience, [...existing, ...answers]);
    });
  }

  return Array.from(byItem.values());
}

export function splitChecklistAnswer(raw: string, choices: string[] = []): string[] {
  // Google Forms 직접 다운로드는 세미콜론, Sheets CSV는 쉼표로 복수 응답을 구분합니다.
  // 쉼표를 포함한 보기 하나를 선택한 경우에는 원문을 그대로 유지합니다.
  if (choices.some(choice => choice.trim() === raw.trim())) return [raw.trim()];
  return raw.split(raw.includes(";") ? ";" : ",").map(value => value.trim()).filter(Boolean);
}

function choiceTab(items: SelectedQuestion[], uploads: ResultUpload[]): string {
  const entries = collectRawAnswers(items, uploads, (item) => needsChoices(item.responseType));

  const blocks = entries
    .map(({ item, answersByAudience }) => {
      const tallyByAudience = new Map<Audience, Map<string, number>>();
      for (const [audience, answers] of answersByAudience) {
        const tally = new Map<string, number>();
        for (const raw of answers) {
          const options = item.responseType === "checklist" ? splitChecklistAnswer(raw, item.choices) : [raw];
          for (const option of options) {
            tally.set(option, (tally.get(option) ?? 0) + 1);
          }
        }
        tallyByAudience.set(audience, tally);
      }

      const optionSet = new Set<string>(item.choices?.map((c) => c.trim()).filter(Boolean) ?? []);
      for (const tally of tallyByAudience.values()) {
        for (const key of tally.keys()) optionSet.add(key);
      }
      const options = Array.from(optionSet);
      if (options.length === 0) return "";

      const audiencesWithData = AUDIENCES.filter((a) => (tallyByAudience.get(a)?.size ?? 0) > 0);
      const rows = options
        .map((option) => {
          const cells = audiencesWithData
            .map((a) => `<td class="num">${tallyByAudience.get(a)?.get(option) ?? 0}</td>`)
            .join("");
          return `<tr><td>${escapeHtml(option)}</td>${cells}</tr>`;
        })
        .join("");

      return `
        <div class="choice-block">
          <h4>${escapeHtml(item.editedQuestion || item.originalQuestion)}</h4>
          <table>
            <thead><tr><th>보기</th>${audiencesWithData.map((a) => `<th>${AUDIENCE_SHORT_LABELS[a]}</th>`).join("")}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .filter(Boolean)
    .join("");

  return `
    <section id="tab-choice" class="tab-panel">
      ${blocks || `<p class="empty">선택형 문항 응답이 없습니다.</p>`}
    </section>`;
}

function textTab(items: SelectedQuestion[], uploads: ResultUpload[]): string {
  const entries = collectRawAnswers(items, uploads, (item) => item.responseType === "text");

  const blocks = entries
    .map(({ item, answersByAudience }) => {
      const groups = AUDIENCES.map((audience) => {
        const answers = answersByAudience.get(audience) ?? [];
        if (answers.length === 0) return "";
        const list = answers
          .map((answer) => `<li>${escapeHtml(maskPersonalInfo(answer))}</li>`)
          .join("");
        return `<div class="text-group"><span class="text-audience">${AUDIENCE_SHORT_LABELS[audience]} (${answers.length}건)</span><ul>${list}</ul></div>`;
      }).join("");

      if (!groups) return "";
      return `
        <div class="text-block">
          <h4>${escapeHtml(item.editedQuestion || item.originalQuestion)}</h4>
          ${groups}
        </div>`;
    })
    .filter(Boolean)
    .join("");

  return `
    <section id="tab-text" class="tab-panel">
      <p class="notice">개인정보(이름·전화번호·이메일·학번)는 자동으로 가렸습니다. 완벽하지 않을 수 있으니 게시 전 한 번 확인하세요.</p>
      ${blocks || `<p class="empty">서술형 문항 응답이 없습니다.</p>`}
    </section>`;
}

const STYLE = `
  :root {
    --brand-600: #4341c4; --text-strong: #16161d; --text-body: #333340; --text-muted: #6b7080;
    --line: #e6e8ef; --bg-page: #eef0f9; --bg-card: #ffffff; --bg-subtle: #f5f6fa;
    --score-high-bg: #ffcdd2; --score-high-ink: #c62828;
    --score-good-bg: #fff9c4; --score-good-ink: #f9a825;
    --score-mid-bg: #e1f5fe; --score-mid-ink: #0277bd;
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; background: var(--bg-page); color: var(--text-body); font-family: "Malgun Gothic", "Pretendard", sans-serif; }
  h1 { color: var(--text-strong); font-size: 22px; margin-bottom: 4px; }
  .meta { color: var(--text-muted); font-size: 13px; margin-bottom: 24px; }
  .tabs { display: flex; gap: 4px; margin-bottom: 16px; }
  .tab-btn { height: 40px; padding: 0 20px; border: 1px solid var(--line); background: var(--bg-card); border-radius: 8px 8px 0 0; cursor: pointer; font-weight: 600; color: var(--text-muted); }
  .tab-btn.is-active { color: var(--brand-600); border-bottom-color: var(--bg-card); }
  .tab-panel { display: none; background: var(--bg-card); border: 1px solid var(--line); border-radius: 0 12px 12px 12px; padding: 24px; }
  .tab-panel.is-active { display: block; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border-bottom: 1px solid var(--line); padding: 8px 12px; text-align: left; font-size: 13px; }
  th { background: var(--bg-subtle); }
  td.num { text-align: right; font-weight: 600; }
  td.q { max-width: 360px; }
  .q-meta { color: var(--text-muted); font-size: 11px; }
  .score-high { background: var(--score-high-bg); color: var(--score-high-ink); }
  .score-good { background: var(--score-good-bg); color: var(--score-good-ink); }
  .score-mid { background: var(--score-mid-bg); color: var(--score-mid-ink); }
  .ai-box { background: var(--bg-subtle); border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; }
  .ai-box h3 { margin: 0 0 8px; font-size: 14px; color: var(--brand-600); }
  .ai-box ul { margin: 8px 0 0; padding-left: 18px; font-size: 13px; }
  .choice-block, .text-block { margin-bottom: 24px; }
  .choice-block h4, .text-block h4 { font-size: 14px; margin-bottom: 4px; }
  .text-group { margin: 8px 0; }
  .text-audience { font-weight: 700; font-size: 12px; color: var(--brand-600); }
  .text-group ul { margin: 4px 0 0; padding-left: 18px; font-size: 13px; }
  .notice { background: var(--bg-subtle); border-radius: 8px; padding: 10px 14px; font-size: 12px; color: var(--text-muted); }
  .empty { color: var(--text-muted); text-align: center; padding: 24px; }
`;

const SCRIPT = `
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("is-active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.getElementById(btn.dataset.tab).classList.add("is-active");
    });
  });
`;

export function buildResultReportHtml(draft: SurveyDraft, items: SelectedQuestion[], result: SurveyResult, uploads: ResultUpload[]): string {
  const title = `${draft.title} 결과 보고서`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
  <h1>${escapeHtml(draft.schoolName)} — ${escapeHtml(title)}</h1>
  <p class="meta">기준일 ${escapeHtml(draft.surveyDate)} · 생성일 ${escapeHtml(result.uploadedAt.slice(0, 10))}</p>

  <div class="tabs">
    <button type="button" class="tab-btn is-active" data-tab="tab-likert">1. 5점 척도</button>
    <button type="button" class="tab-btn" data-tab="tab-choice">2. 선택형</button>
    <button type="button" class="tab-btn" data-tab="tab-text">3. 서술형</button>
  </div>

  ${likertTab(draft, items, result)}
  ${choiceTab(items, uploads)}
  ${textTab(items, uploads)}

  <script>${SCRIPT}</script>
</body>
</html>`;
}

export function resultReportFileName(draft: SurveyDraft): string {
  const safe = draft.schoolName.replace(/[<>:"/\\|?*\s]+/g, "_");
  return `설문결과_${safe}.html`;
}
