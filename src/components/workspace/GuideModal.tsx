"use client";

import { useEffect, useState } from "react";
import { GUIDE_STEPS } from "@/lib/guideSteps";

export function GuideModal({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const step = GUIDE_STEPS[index];
  const last = index === GUIDE_STEPS.length - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowRight") {
        setIndex((current) => Math.min(GUIDE_STEPS.length - 1, current + 1));
      }
      if (event.key === "ArrowLeft") {
        setIndex((current) => Math.max(0, current - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ws-overlay" role="dialog" aria-modal="true" aria-label="도움말">
      <div className="ws-modal guide-modal">
        <div className="ws-modal-head">
          <h2>도움말</h2>
          <button type="button" className="ws-icon-btn" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="guide-layout">
          <nav className="guide-toc" aria-label="도움말 목차">
            {GUIDE_STEPS.map((entry, entryIndex) => (
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
            <div className="guide-frame">
              <img src={step.image} alt={step.title} className="guide-image" />
              <span
                className="guide-highlight"
                style={{
                  top: step.highlight.top,
                  left: step.highlight.left,
                  width: step.highlight.width,
                  height: step.highlight.height
                }}
              />
            </div>
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
                {GUIDE_STEPS.map((entry, entryIndex) => (
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
    </div>
  );
}
