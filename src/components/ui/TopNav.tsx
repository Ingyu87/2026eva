import type { ReactNode } from "react";

export type TopNavProps = {
  brand: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function TopNav({ brand, actions, className = "" }: TopNavProps) {
  return (
    <header className={["ds-top-nav", className].filter(Boolean).join(" ")}>
      <div className="ds-top-nav__brand">{brand}</div>
      {actions ? <div className="ds-top-nav__actions">{actions}</div> : null}
    </header>
  );
}
