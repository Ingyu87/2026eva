"use client";

/**
 * 학년말로 바꿨을 때 처음 보여 주는 화면.
 *
 * 남아 있는 문항은 보통 올해 중간평가에서 담아 둔 것입니다. 작년 문항이 아닙니다.
 * 같은 문항으로 학년말 설문을 다시 받고, 그 새 결과만 제출 서류에 넣습니다. (가이드북 Q12)
 * 문항을 바꾸고 싶으면 비운 뒤 다시 고를 수 있습니다.
 */
export function AnnualStart({
  itemCount,
  legacyCount,
  onReviewItems,
  onOpenAnalyze,
  onStartFresh
}: {
  itemCount: number;
  legacyCount: number;
  onReviewItems: () => void;
  onOpenAnalyze: () => void;
  onStartFresh: () => void;
}) {
  return (
    <div className="ws-start">
      <div className="ws-start-card">
        <p className="ws-start-kicker">학년말 학교평가</p>
        <h2>중간평가 문항이 그대로 있습니다</h2>
        <p className="ws-hint">
          {itemCount}개는 올해 중간평가에서 담아 둔 문항입니다. 학년말에도 같은 문항으로
          설문을 다시 받는 것이 기본입니다. 바꾸고 싶으면 비운 뒤 다시 고르면 됩니다.
        </p>
        {legacyCount > 0 ? (
          <p className="ws-hint">
            그중 {legacyCount}개는 2026 세부영역이 아닙니다. 남기려면 수정에서 세부영역을
            다시 고르세요.
          </p>
        ) : null}

        <div className="ws-start-actions">
          {itemCount > 0 ? (
            <button type="button" className="ws-start-action" onClick={onReviewItems}>
              <strong>1. 이 문항으로 학년말 설문 만들기</strong>
              <span>
                고칠 문항만 손보고, 위쪽의 설문지(DOCX)와 Google Forms로 학년말 설문을 받습니다.
              </span>
            </button>
          ) : null}
          <button type="button" className="ws-start-action" onClick={onStartFresh}>
            <strong>{itemCount > 0 ? "2" : "1"}. 비우고 문항을 처음부터 다시 고르기</strong>
            <span>중간평가 문항을 모두 지운 뒤 빈 화면에서 다시 담습니다. 다른 부장이 담은 것도 사라집니다.</span>
          </button>
          <button type="button" className="ws-start-action" onClick={onOpenAnalyze}>
            <strong>{itemCount > 0 ? "3" : "2"}. 학년말 결과 올리기</strong>
            <span>학년말 응답 엑셀을 올립니다. 중간평가 때 받은 파일은 쓰지 마세요.</span>
          </button>
        </div>
      </div>
    </div>
  );
}
