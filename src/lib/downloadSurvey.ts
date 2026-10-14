import type { ExportAudience, SurveyFileFormat } from "./surveyExport";

/** 실패한 응답을 문서로 저장하거나 오류 페이지로 이동하지 않는다. */
export async function fetchSurveyDownload(format: SurveyFileFormat, audience: ExportAudience, signal: AbortSignal) {
  const response = await fetch(`/api/export/${format}?audience=${audience}`, { cache: "no-store", signal });
  if (!response.ok) {
    if (response.status === 401) throw new Error("로그인이 만료되었습니다. 미저장 내용을 보관한 뒤 다시 로그인해 주세요.");
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.error === "string" ? body.error : "파일을 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  const expected = format === "hwpx" ? "application/hwp+zip" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (response.headers.get("Content-Type")?.split(";")[0] !== expected) {
    throw new Error("정상적인 설문지 파일을 받지 못했습니다. 다시 시도해 주세요.");
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error("파일이 비어 있습니다. 다시 시도해 주세요.");
  let fileName = `학교평가_설문지.${format}`;
  const encoded = response.headers.get("Content-Disposition")?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { fileName = decodeURIComponent(encoded).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_"); } catch { /* 기본 파일명 사용 */ }
  }
  return { blob, fileName };
}
