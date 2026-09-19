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
        <h3>{label}님, 문항을 고르는 화면입니다</h3>
        <p className="conflict-meta">
          {schoolName} 설문에 들어갈 문항을 담는 곳입니다. 설문 시기, 결과 분석, 제출 서류는
          연구부장이 맡습니다.
        </p>
        <p className="conflict-meta">1. 왼쪽에서 영역·지표를 고르고, 문항 카드의 대상 칩을 눌러 담습니다.</p>
        <p className="conflict-meta">2. 오른쪽 목록에서 문장을 고칠 수 있습니다. 저장은 자동입니다.</p>
        <p className="conflict-meta">3. 다 했으면 연구부장에게 알려 주세요.</p>
        <p className="conflict-meta">
          {audienceLabel
            ? `이 링크로는 ${audienceLabel}용 문항만 다룰 수 있습니다. `
            : ""}
          링크는 다른 사람에게 넘기지 마세요. 창을 닫아도 같은 링크를 다시 열면 이어집니다.
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
        <h3>이렇게 진행합니다</h3>
        <p className="conflict-meta">1. 왼쪽 위 배지에서 평가 시기(중간평가 / 학년말)를 확인합니다.</p>
        <p className="conflict-meta">
          2. 위쪽 부장 링크 버튼으로 부장마다 링크를 만들어 보냅니다. 부장이 담은 문항은 이 화면에 그대로
          모입니다.
        </p>
        <p className="conflict-meta">
          3. 연구부장도 같은 화면에서 문항을 담습니다. 오른쪽 아래 영역 커버리지에서 Ⅰ·Ⅱ·Ⅲ 영역이 모두
          채워졌는지 확인하세요.
        </p>
        <p className="conflict-meta">
          4. 부장들이 제출하면 설문지(DOCX)나 Google Forms로 내보냅니다. 응답을 받은 뒤에는 결과 분석에서
          제출 서류를 만듭니다.
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
