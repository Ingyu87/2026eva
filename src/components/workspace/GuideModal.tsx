"use client";

import { useEffect, useState } from "react";
import { getGuideSteps, type GuideVariant } from "@/lib/guideSteps";

export function GuideModal({
  variant = "lead",
  onClose
}: {
  variant?: GuideVariant;
  onClose: () => void;
}) {
  const steps = getGuideSteps(variant);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const step = steps[index];
  const last = index === steps.length - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (zoom) setZoom(false); else onClose();
      }
      if (!zoom && event.key === "ArrowRight") {
        setIndex((current) => Math.min(steps.length - 1, current + 1));
      }
      if (!zoom && event.key === "ArrowLeft") {
        setIndex((current) => Math.max(0, current - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, steps.length, zoom]);

  return (
    <div className="ws-overlay" role="dialog" aria-modal="true" aria-label="도움말">
      <div className="ws-modal guide-modal">
        <div className="ws-modal-head">
          <h2>{variant === "builder" ? "도움말 (문항 작업)" : "도움말 (연구부장)"}</h2>
          <button type="button" className="ws-icon-btn" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="guide-layout">
          <nav className="guide-toc" aria-label="도움말 목차">
            {steps.map((entry, entryIndex) => (
              <button
                key={entry.id}
                type="button"
                className={entryIndex === index ? "guide-toc-item is-active" : "guide-toc-item"}
                onClick={() => setIndex(entryIndex)}
              >
                {entry.title}
              </button>
            ))}
          </nav>

          <div className="guide-main">
            <p className="ws-hint">예시학교 화면입니다. 사진을 누르면 크게 볼 수 있습니다.</p>
            {step.image ? (
              <button type="button" className="guide-frame" aria-label={`${step.title} 사진 크게 보기`} onClick={() => setZoom(true)}>
                <img src={step.image} alt={`${step.title} 실제 작업 화면`} className="guide-image" />
              </button>
            ) : null}
            <p className="guide-caption">
              <strong>{step.title}</strong>
              {step.caption}
            </p>
            <div className="guide-nav">
              <button
                type="button"
                className="ws-btn ws-btn--soft"
                disabled={index === 0}
                onClick={() => setIndex((current) => current - 1)}
              >
                이전
              </button>
              <div className="guide-dots" role="tablist" aria-label="장면">
                {steps.map((entry, entryIndex) => (
                  <button
                    key={entry.id}
                    type="button"
                    role="tab"
                    aria-selected={entryIndex === index}
                    aria-label={entry.title}
                    className={entryIndex === index ? "guide-dot is-on" : "guide-dot"}
                    onClick={() => setIndex(entryIndex)}
                  />
                ))}
              </div>
              {last ? (
                <button type="button" className="ws-btn ws-btn--primary" onClick={onClose}>
                  닫기
                </button>
              ) : (
                <button
                  type="button"
                  className="ws-btn ws-btn--primary"
                  onClick={() => setIndex((current) => current + 1)}
                >
                  다음
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {zoom && step.image ? <div className="guide-zoom" role="dialog" aria-modal="true" aria-label="사진 크게 보기">
        <button type="button" className="ws-btn ws-btn--primary" autoFocus onClick={()=>setZoom(false)}>사진 닫기</button>
        <img src={step.image} alt={`${step.title} 실제 작업 화면 확대`} />
      </div> : null}
    </div>
  );
}
