"use client";

import { Button } from "@/components/ui";

/**
 * 부장 링크로 처음 들어온 사람에게 한 번만 보이는 안내입니다.
 * 문항 수백 개 앞에서 무엇을 하면 되는지 먼저 알려 줍니다.
 */
export function BuilderIntro({
  schoolName,
  label,
  audienceLabel,
  onStart,
  onGuide
}: {
  schoolName: string;
  label: string;
  audienceLabel?: string;
  onStart: () => void;
  onGuide: () => void;
}) {
  return (
    <div className="conflict-overlay" role="dialog" aria-modal="true" aria-label="시작 안내">
      <div className="conflict-dialog">
        <h3>{label}님 · 설문 문항 작성</h3>
        <p className="conflict-meta">
          {schoolName} 설문에 사용할 문항을 작성하세요.
        </p>
        <p className="conflict-meta">1. 문항을 검색해 추가하거나 직접 작성하세요.</p>
        <p className="conflict-meta">2. 오른쪽 목록에서 문항을 수정하세요. 수정한 내용은 자동 저장됩니다.</p>
        <p className="conflict-meta">3. 작성을 마치면 상단 ‘제출’을 누르세요.</p>
        <p className="conflict-meta">
          {audienceLabel
            ? `이 링크로는 ${audienceLabel}용 문항을 작성할 수 있습니다. `
            : ""}
          같은 링크로 다시 접속할 수 있습니다. 링크는 다른 사람에게 공유하지 마세요.
        </p>
        <div className="conflict-actions">
          <Button type="button" onClick={onStart}>
            시작하기
          </Button>
          <Button type="button" variant="secondary" onClick={onGuide}>
            도움말 보기
          </Button>
        </div>
      </div>
    </div>
  );
}

/** 연구부장이 처음 들어왔을 때 한 번만 보이는 진행 순서 안내입니다. */
export function LeadIntro({ onStart, onGuide }: { onStart: () => void; onGuide: () => void }) {
  return (
    <div className="conflict-overlay" role="dialog" aria-modal="true" aria-label="시작 안내">
      <div className="conflict-dialog">
        <h3>학교 설문 작성</h3>
        <p className="conflict-meta">1. 평가 시기를 선택하고 대상별 문항을 작성하세요. 부장과 나누어 작성하려면 ‘부장 링크’를 보내세요.</p>
        <p className="conflict-meta">2. 문항을 검토한 뒤 설문지를 내려받거나 Google Forms를 만드세요.</p>
        <p className="conflict-meta">3. 응답을 받으면 ‘결과 분석’에서 집계하고 평가 의견과 보고서를 작성하세요.</p>
        <div className="conflict-actions">
          <Button type="button" onClick={onStart}>
            시작하기
          </Button>
          <Button type="button" variant="secondary" onClick={onGuide}>
            도움말 보기
          </Button>
        </div>
      </div>
    </div>
  );
}
