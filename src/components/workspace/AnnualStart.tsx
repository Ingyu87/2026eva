"use client";

import { PriorSurveyImport, type PriorSurveyCommit } from "./PriorSurveyImport";

/**
 * 학년말로 바꿨을 때 처음 보여 주는 화면.
 * 중간평가 문항을 이어서 쓰거나, 비우고 다시 고르거나, 전년도 학년말 문항지 PDF를 올립니다.
 */
export function AnnualStart({
  itemCount,
  onReviewItems,
  onStartFresh,
  onImportPrior
}: {
  itemCount: number;
  onReviewItems: () => void;
  onStartFresh: () => void;
  onImportPrior: (items: PriorSurveyCommit[]) => void;
}) {
  return (
    <div className="ws-start">
      <div className="ws-start-card">
        <p className="ws-start-kicker">학년말 학교평가</p>
        <h2>중간평가 문항 {itemCount}개</h2>

        <div className="ws-start-actions">
          {itemCount > 0 ? (
            <button type="button" className="ws-start-action" onClick={onReviewItems}>
              <strong>이 문항으로 학년말 설문 만들기</strong>
            </button>
          ) : null}
          <button type="button" className="ws-start-action" onClick={onStartFresh}>
            <strong>비우고 다시 고르기</strong>
          </button>
          <PriorSurveyImport onCommit={onImportPrior} />
        </div>
      </div>
    </div>
  );
}
