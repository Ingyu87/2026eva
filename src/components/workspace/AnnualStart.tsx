"use client";

import { PriorSurveyImport, type PriorSurveyCommit } from "./PriorSurveyImport";

/**
 * 학년말로 바꿨을 때 처음 보여 주는 화면.
 * 중간평가 문항을 이어서 쓰거나, 비우고 다시 고르거나, 전년도 학년말 문항지 PDF를 올립니다.
 */
export function AnnualStart({
  draftId,
  itemCount,
  onReviewItems,
  onStartFresh,
  onImportPrior
}: {
  draftId: string;
  itemCount: number;
  onReviewItems: () => void;
  onStartFresh: () => void;
  onImportPrior: (items: PriorSurveyCommit[]) => void;
}) {
  return (
    <div className="ws-start">
      <div className="ws-start-card">
        <h2>설문 문항 만들기</h2>
        <p className="ws-hint">작년 설문을 가져오거나 새로 작성하세요.</p>

        <div className="ws-start-actions">
          <PriorSurveyImport key={draftId} draftId={draftId} onCommit={onImportPrior} />
          {itemCount > 0 ? (
            <button type="button" className="ws-start-action" onClick={onReviewItems}>
              <strong>저장된 문항 수정</strong>
            </button>
          ) : null}
          <button type="button" className="ws-start-action" onClick={onStartFresh}>
            <strong>{itemCount > 0 ? "비우고 새로 만들기" : "새로 만들기"}</strong>
          </button>
        </div>
      </div>
    </div>
  );
}
