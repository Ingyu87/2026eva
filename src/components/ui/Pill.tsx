import type { ButtonHTMLAttributes, ReactNode } from "react";

export type PillProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  selected?: boolean;
  children: ReactNode;
  className?: string;
};

export function Pill({ selected = false, children, className = "", type = "button", ...rest }: PillProps) {
  const cls = [
    "ds-pill-tab",
    "ds-focusable",
    selected ? "ds-pill-tab--selected" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
