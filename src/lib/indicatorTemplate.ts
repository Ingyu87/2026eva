/**
 * 평가지표 및 현황 XLSX 템플릿 자동 인식 + 값 주입 (spec.md 7.1, 8-1).
 *
 * ⚠️ 셀 주소를 하드코딩하지 않습니다. 2026 템플릿은 Ⅲ-2·Ⅲ-3이 통합되면서 행이
 * 밀리므로, 매번 "평가 주체별 문항 수"/"평가 주체별 평가 결과" 헤더를 찾아 구조를
 * 다시 읽습니다. 학교가 채워 넣을 수 있는 칸은 헤더 텍스트가 아니라 **셀 잠금 해제
 * 여부**(`protection.locked === false`)로 찾습니다 — 템플릿 1쪽 경고("배경색이 있는
 * 셀만 입력가능")가 그대로 시트 보호 설정으로 들어가 있어, 이 방법이 헤더 위치가
 * 밀려도 흔들리지 않습니다.
 */

import type ExcelJS from "exceljs";
import { AREAS, areaOfSubarea } from "./evaluationFramework";
import { AUDIENCES, AUDIENCE_SHORT_LABELS, type Audience, type AreaStat, type Grade4, type SelectedQuestion } from "./types";

export type TemplateRow = {
  row: number;
  area: string;
  subarea: string;
  /** 원문 그대로. "기타 :" / "기타:" 도 여기 들어옵니다. */
  indicator: string;
};

export type TemplateMap = {
  sheetName: string;
  headerRow: number;
  areaCol: number;
  subareaCol: number;
  indicatorCol: number;
  countCols: Record<Audience, number>;
  resultCols: Record<Audience, number>;
  schoolNameCell: { row: number; col: number } | null;
  /** "합계" 행(수식)은 잠겨 있어 자동으로 빠집니다. 손댈 필요가 없습니다. */
  rows: TemplateRow[];
};

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object" && "richText" in (value as { richText?: unknown })) {
    return (value as { richText: Array<{ text: string }> }).richText.map((run) => run.text).join("");
  }
  if (typeof value === "object" && "result" in (value as { result?: unknown })) {
    return String((value as { result?: unknown }).result ?? "");
  }
  return String(value).trim();
}

function isUnlocked(cell: ExcelJS.Cell): boolean {
  return cell.protection?.locked === false;
}

const HEADER_COUNT_TEXT = "평가 주체별 문항 수";
const HEADER_RESULT_TEXT = "평가 주체별 평가 결과";

/** "기타 :" / "기타:" / "기타 ：" 등 표기가 흔들려도 잡습니다. */
export function isEtcIndicator(indicator: string): boolean {
  return /^기타\s*[:：]?\s*$/.test(indicator);
}

/**
 * 템플릿 구조를 스캔합니다. 헤더 문자열로 표 위치를 찾고, 학교가 채울 수 있는
 * 칸(문항 수·평가 결과)은 잠금 해제 여부로 찾습니다.
 */
export function scanIndicatorTemplate(workbook: ExcelJS.Workbook): TemplateMap {
  let sheet: ExcelJS.Worksheet | undefined;
  let headerRow = -1;
  let countStartCol = -1;
  let resultStartCol = -1;

  for (const ws of workbook.worksheets) {
    const searchRows = Math.min(ws.rowCount, 20);
    for (let r = 1; r <= searchRows; r += 1) {
      const row = ws.getRow(r);
      let countCol = -1;
      let resultCol = -1;
      const searchCols = Math.min(row.cellCount + 5, 60);
      for (let c = 1; c <= searchCols; c += 1) {
        const text = cellText(row.getCell(c));
        if (text === HEADER_COUNT_TEXT && countCol === -1) countCol = c;
        if (text === HEADER_RESULT_TEXT && resultCol === -1) resultCol = c;
      }
      if (countCol !== -1 && resultCol !== -1) {
        sheet = ws;
        headerRow = r;
        countStartCol = countCol;
        resultStartCol = resultCol;
        break;
      }
    }
    if (sheet) break;
  }

  if (!sheet || headerRow === -1) {
    throw new Error(`템플릿에서 "${HEADER_COUNT_TEXT}"/"${HEADER_RESULT_TEXT}" 표를 찾지 못했습니다.`);
  }

  const headerCells = sheet.getRow(headerRow);
  let areaCol = -1;
  let subareaCol = -1;
  let indicatorCol = -1;
  for (let c = 1; c < countStartCol; c += 1) {
    const text = cellText(headerCells.getCell(c));
    if (text === "영역" && areaCol === -1) areaCol = c;
    else if (text === "세부영역" && subareaCol === -1) subareaCol = c;
    else if (text === "평가지표" && indicatorCol === -1) indicatorCol = c;
  }
  if (areaCol === -1 || subareaCol === -1 || indicatorCol === -1) {
    throw new Error("템플릿에서 영역/세부영역/평가지표 열을 찾지 못했습니다.");
  }

  const subLabelRow = sheet.getRow(headerRow + 1);
  const shortLabelToAudience = Object.fromEntries(
    AUDIENCES.map((audience) => [AUDIENCE_SHORT_LABELS[audience], audience])
  ) as Record<string, Audience>;

  function mapBand(startCol: number, headerLabel: string): Record<Audience, number> {
    const map: Partial<Record<Audience, number>> = {};
    for (let c = startCol; c < startCol + 4; c += 1) {
      const label = cellText(subLabelRow.getCell(c));
      const audience = shortLabelToAudience[label];
      if (audience) {
        map[audience] = c;
      }
    }
    for (const audience of AUDIENCES) {
      if (map[audience] === undefined) {
        throw new Error(`템플릿의 "${headerLabel}" 아래에서 "${AUDIENCE_SHORT_LABELS[audience]}" 열을 찾지 못했습니다.`);
      }
    }
    return map as Record<Audience, number>;
  }

  const countCols = mapBand(countStartCol, HEADER_COUNT_TEXT);
  const resultCols = mapBand(resultStartCol, HEADER_RESULT_TEXT);

  let schoolNameCell: { row: number; col: number } | null = null;
  for (let r = 1; r <= headerRow && !schoolNameCell; r += 1) {
    const row = sheet.getRow(r);
    const searchCols = Math.min(row.cellCount + 5, resultStartCol + 4);
    for (let c = 1; c <= searchCols; c += 1) {
      const text = cellText(row.getCell(c)).replace(/\s/g, "");
      if (text.startsWith("학교명")) {
        for (let cc = c + 1; cc <= c + 6; cc += 1) {
          if (isUnlocked(row.getCell(cc))) {
            schoolNameCell = { row: r, col: cc };
            break;
          }
        }
        break;
      }
    }
  }

  const rows: TemplateRow[] = [];
  const countColList = Object.values(countCols);
  for (let r = headerRow + 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const isFillable = countColList.some((c) => isUnlocked(row.getCell(c)));
    if (!isFillable) {
      continue; // "합계" 행은 수식+잠김이라 여기서 자동으로 빠집니다.
    }
    rows.push({
      row: r,
      area: cellText(row.getCell(areaCol)).replace(/\s+/g, " ").trim(),
      subarea: cellText(row.getCell(subareaCol)).trim(),
      indicator: cellText(row.getCell(indicatorCol)).trim()
    });
  }

  if (!rows.length) throw new Error("입력 가능한 지표 행이 없습니다.");
  for (const row of rows) {
    const expected = areaOfSubarea(row.subarea);
    if (!expected || expected.name.replace(/\s/g, "") !== row.area.replace(/\s/g, "")) {
      throw new Error(`${row.row}행의 영역·세부영역이 2026 평가체제와 다릅니다. 교육청의 2026 양식을 등록하세요: ${row.subarea}`);
    }
    row.area = expected.name;
  }
  const missing = AREAS.flatMap(area => area.subareas).filter(subarea => !rows.some(row => row.subarea === subarea));
  if (missing.length) throw new Error(`양식에 2026 세부영역이 빠져 있습니다: ${missing.join(", ")}`);
  return { sheetName: sheet.name, headerRow, areaCol, subareaCol, indicatorCol, countCols, resultCols, schoolNameCell, rows };
}

export type FillResult = {
  /** 템플릿에 있지만 앱의 문항과 이름이 안 맞아 문항 수를 못 채운 지표. 학교가 직접 확인해야 합니다. */
  unmatchedIndicators: TemplateRow[];
};

/**
 * 스캔한 구조에 실제 값을 채워 넣습니다. 문항 수는 지표명(세부영역+평가지표)으로
 * 앱의 선택 문항과 매칭하고, 못 찾은 지표는 "기타" 행으로 몰아 합산합니다.
 * "기타" 행 자체는 지표명이 자유 서술이라 매칭하지 않고, 학교가 원래 쓴 텍스트를 그대로 둡니다.
 */
export function fillIndicatorTemplate(
  workbook: ExcelJS.Workbook,
  map: TemplateMap,
  input: { schoolName: string; items: SelectedQuestion[]; areaStats: AreaStat[] }
): FillResult {
  const sheet = workbook.getWorksheet(map.sheetName);
  if (!sheet) {
    throw new Error("템플릿 시트를 다시 찾을 수 없습니다.");
  }

  if (map.schoolNameCell) {
    sheet.getRow(map.schoolNameCell.row).getCell(map.schoolNameCell.col).value = input.schoolName;
  }

  // 세부영역별로 "정식 지표 행"의 이름 집합을 만듭니다. 여기 없는 지표는 전부 "기타"로 몰립니다.
  const knownIndicatorsBySubarea = new Map<string, Set<string>>();
  for (const row of map.rows) {
    if (isEtcIndicator(row.indicator)) continue;
    const set = knownIndicatorsBySubarea.get(row.subarea) ?? new Set<string>();
    set.add(row.indicator);
    knownIndicatorsBySubarea.set(row.subarea, set);
  }

  // 문항 수: (세부영역, 지표명 또는 "기타", 주체)별로 살아있는 선택 문항 개수를 셉니다.
  const countByKey = new Map<string, number>();
  const bump = (subarea: string, indicator: string, audience: Audience) => {
    const key = `${subarea} ${indicator} ${audience}`;
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
  };
  for (const item of input.items) {
    if (item.deleted) continue;
    const known = knownIndicatorsBySubarea.get(item.subarea);
    const isKnown = known?.has(item.indicator) ?? false;
    if (!isKnown && !map.rows.some(row => row.subarea === item.subarea && isEtcIndicator(row.indicator))) {
      throw new Error(`${item.subarea}의 '${item.indicator}'를 넣을 지표 행 또는 기타 행이 없습니다. 관리자에게 양식 확인을 요청하세요.`);
    }
    bump(item.subarea, isKnown ? item.indicator : "__etc__", item.audience);
  }

  const gradeByAreaAudience = new Map<string, Grade4>();
  for (const stat of input.areaStats) {
    gradeByAreaAudience.set(`${stat.area} ${stat.audience}`, stat.grade4);
  }

  const unmatchedIndicators: TemplateRow[] = [];

  for (const row of map.rows) {
    const isEtc = isEtcIndicator(row.indicator);
    const lookupIndicator = isEtc ? "__etc__" : row.indicator;
    let matchedAny = false;

    for (const audience of AUDIENCES) {
      const count = countByKey.get(`${row.subarea} ${lookupIndicator} ${audience}`);
      if (count !== undefined) {
        matchedAny = true;
      }
      // 항상 씁니다(값이 없으면 지웁니다). 이 파일은 매년 같은 통을 재사용하는 경우가 많아서,
      // 없을 때 그냥 두면 작년 값이 올해 것처럼 그대로 남습니다.
      sheet.getRow(row.row).getCell(map.countCols[audience]).value = count ?? null;

      const grade = gradeByAreaAudience.get(`${row.area} ${audience}`);
      sheet.getRow(row.row).getCell(map.resultCols[audience]).value = grade ?? null;
    }

    // "기타" 행은 학교가 지표를 안 정했으면 원래 비어 있는 게 정상이라 미확인 목록에 넣지 않습니다.
    if (!isEtc && !matchedAny && row.indicator) {
      unmatchedIndicators.push(row);
    }
  }

  return { unmatchedIndicators };
}
