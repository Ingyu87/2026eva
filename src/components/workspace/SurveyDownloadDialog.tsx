"use client";

import { useEffect, useRef, useState } from "react";
import { fetchSurveyDownload } from "@/lib/downloadSurvey";
import { AUDIENCES, AUDIENCE_LABELS, type Audience, type SelectedQuestion } from "@/lib/types";
import { selectExportItems, type ExportAudience, type SurveyFileFormat } from "@/lib/surveyExport";

export function SurveyDownloadDialog({ format, initialAudience, items, pendingCount, beforeDownload, onRetrySave, onClose }: {
  format: SurveyFileFormat;
  initialAudience: Audience;
  items: SelectedQuestion[];
  pendingCount: number;
  beforeDownload: () => boolean;
  onRetrySave: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const [audience, setAudience] = useState<ExportAudience>(initialAudience);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const count = selectExportItems(items, audience).length;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { request.current?.abort(); element?.close(); };
  }, []);

  const download = async () => {
    if (request.current || pendingCount || !count || !beforeDownload()) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setDone(false);
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const { blob, fileName } = await fetchSurveyDownload(format, audience, controller.signal);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDone(true);
    } catch (cause) {
      setError(controller.signal.aborted ? "다운로드 시간이 초과되었습니다. 다시 시도해 주세요." :
        cause instanceof Error && cause.name !== "TypeError" ? cause.message : "연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      clearTimeout(timeout);
      request.current = null;
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} className="ws-modal ws-download-dialog" aria-labelledby="survey-download-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="ws-modal-head">
        <h2 id="survey-download-title">{format === "hwpx" ? "한글 (HWPX)" : "설문지 (DOCX)"} 다운로드</h2>
        <button type="button" className="ws-icon-btn" aria-label="닫기" onClick={onClose}>✕</button>
      </div>
      <div className="ws-modal-body ws-form">
        <label className="ws-field">
          <span>다운로드 대상</span>
          <select className="ws-select" value={audience} disabled={busy} onChange={event => {
            setAudience(event.target.value as ExportAudience); setError(""); setDone(false);
          }}>
            {AUDIENCES.map(value => <option key={value} value={value}>{AUDIENCE_LABELS[value]} ({selectExportItems(items, value).length}문항)</option>)}
            <option value="all">전체 대상 ({selectExportItems(items, "all").length}문항)</option>
          </select>
        </label>
        <p className="ws-hint">저장된 문항과 안내문으로 만듭니다. 전체 대상은 대상별로 새 쪽에서 시작합니다.</p>
        {pendingCount > 0 ? <div role="status">
          <p>저장되지 않은 편집이 {pendingCount}건 있습니다. 저장을 마친 뒤 내려받을 수 있습니다.</p>
          <button type="button" className="ws-btn ws-btn--soft" onClick={onRetrySave}>저장 다시 시도</button>
        </div> : null}
        {!count ? <p role="status">선택한 대상에 문항이 없습니다.</p> : null}
        {error ? <p className="ws-download-error" role="alert">{error}</p> : null}
        <p role="status" aria-live="polite">{busy ? "파일을 만드는 중입니다…" : done ? "브라우저로 파일을 전달했습니다. 다운로드 목록을 확인해 주세요." : count ? `${count}문항을 내려받습니다.` : "문항이 있는 대상을 선택해 주세요."}</p>
        <button type="button" className="ws-btn ws-btn--primary" disabled={busy || pendingCount > 0 || !count} onClick={() => void download()}>
          {busy ? "파일 만드는 중…" : "다운로드"}
        </button>
      </div>
    </dialog>
  );
}
