import type { ReactNode } from "react";

export type FooterProps = {
  wordmark?: string;
  children?: ReactNode;
  className?: string;
};

export function Footer({ wordmark = "School Evaluation", children, className = "" }: FooterProps) {
  return (
    <footer className={["ds-footer", className].filter(Boolean).join(" ")}>
      <p className="ds-footer__wordmark w-340">{wordmark}</p>
      {children ? <div className="ds-footer__meta">{children}</div> : null}
    </footer>
  );
}
