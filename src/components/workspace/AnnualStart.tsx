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
        <p className="ws-start-kicker">올해 설문 준비</p>
        <h2>작년 설문으로 시작할까요?</h2>
        <p className="ws-hint">작년 문항을 가져와 올해 문항을 준비할 수 있습니다. 가져온 뒤에는 우리 학교 문항만 보며 수정합니다. 필요한 경우 ‘예시문항에서 추가’를 누르세요.</p>

        <div className="ws-start-actions">
          <PriorSurveyImport key={draftId} draftId={draftId} onCommit={onImportPrior} />
          {itemCount > 0 ? (
            <button type="button" className="ws-start-action" onClick={onReviewItems}>
              <strong>저장된 문항으로 이어서 작업하기</strong>
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
