import type { ReactNode } from "react";

export type MarqueeStripProps = {
  children?: ReactNode;
  /** 화면에 표시할 텍스트 (children보다 우선하지 않음 — children이 있으면 children 사용) */
  text?: string;
  className?: string;
};

export function MarqueeStrip({ children, text, className = "" }: MarqueeStripProps) {
  const content = children ?? text;
  if (content == null || content === "") {
    return null;
  }
  return (
    <div className={["ds-marquee", className].filter(Boolean).join(" ")} role="presentation">
      <div className="ds-marquee__inner typ-body-sm w-330">{content}</div>
    </div>
  );
}
