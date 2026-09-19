/**
 * 결과 파일(XLSX/CSV) 읽기 (spec.md 6.2 `/api/results/upload`, 7.1 `exceljs`).
 *
 * 구글폼 응답을 다운로드한 파일을 그대로 올린다고 가정합니다: 첫 행 = 문항 제목(열 제목),
 * 그 아래 행 = 응답자 1명당 1행. 셀 값은 척도 라벨 문자열이거나 서술형 원문입니다.
 */

import ExcelJS from "exceljs";
import { Readable } from "node:stream";

export type ParsedResultFile = {
  headers: string[];
  /** 응답자별 1행. 각 값은 `headers`와 같은 순서입니다. */
  rows: string[][];
};

function isCsvFilename(filename: string): boolean {
  return filename.toLowerCase().endsWith(".csv");
}

function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object" && "text" in value) {
    // 리치 텍스트 등 exceljs가 객체로 돌려주는 값
    return String((value as { text: unknown }).text ?? "").trim();
  }
  return String(value).trim();
}

function readSheetRows(sheet: ExcelJS.Worksheet): ParsedResultFile {
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = cellToText(cell.value);
  });

  const rows: string[][] = [];
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    if (row.actualCellCount === 0) {
      continue;
    }
    const values: string[] = [];
    for (let c = 1; c <= headers.length; c += 1) {
      values[c - 1] = cellToText(row.getCell(c).value);
    }
    rows.push(values);
  }

  return { headers, rows };
}

/** 학교가 올린 XLSX 또는 CSV 파일을 표(헤더 + 행)로 바꿉니다. 시트는 첫 번째 것만 씁니다. */
export async function parseResultFile(buffer: Buffer, filename: string): Promise<ParsedResultFile> {
  const workbook = new ExcelJS.Workbook();

  // exceljs가 번들한 타입 선언이 이 프로젝트의 @types/node와 다른 Buffer 제네릭을 가리키고 있어
  // 런타임에는 같은 Buffer인데도 구조적 타입 에러가 납니다. 여기서만 any로 우회합니다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excelBuffer = buffer as any;
  if (isCsvFilename(filename)) {
    await workbook.csv.read(Readable.from(excelBuffer));
  } else {
    await workbook.xlsx.load(excelBuffer);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("파일에서 시트를 찾을 수 없습니다.");
  }
  const parsed = readSheetRows(sheet);
  if (parsed.headers.filter(Boolean).length === 0) {
    throw new Error("첫 번째 행에서 열 제목을 찾을 수 없습니다.");
  }
  return parsed;
}
