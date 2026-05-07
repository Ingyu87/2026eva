import type { ButtonHTMLAttributes, ReactNode } from "react";

export type IconButtonVariant = "light" | "inverse";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: IconButtonVariant;
  className?: string;
  children: ReactNode;
  "aria-label": string;
};

export function IconButton({ variant = "light", className = "", children, ...rest }: IconButtonProps) {
  const cls = [
    "ds-icon-btn",
    "ds-focusable",
    variant === "inverse" ? "ds-icon-btn--inverse" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
