import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "magenta" | "danger";

type Base = {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
  loading?: boolean;
};

export type ButtonProps =
  | (Base &
      ButtonHTMLAttributes<HTMLButtonElement> & {
        href?: undefined;
      })
  | (Base &
      AnchorHTMLAttributes<HTMLAnchorElement> & {
        href: string;
      });

function variantClass(variant: ButtonVariant): string {
  switch (variant) {
    case "secondary":
      return "ds-btn--secondary";
    case "tertiary":
      return "ds-btn--tertiary";
    case "magenta":
      return "ds-btn--magenta";
    case "danger":
      return "ds-btn--danger";
    default:
      return "ds-btn--primary";
  }
}

export function Button(props: ButtonProps) {
  const { variant = "primary", children, className = "", loading } = props;
  const cls = ["ds-btn", "ds-focusable", variantClass(variant), className].filter(Boolean).join(" ");

  if ("href" in props && props.href) {
    const { href, ...anchorRest } = props;
    const external = href.startsWith("http");
    const label = loading ? "…" : children;
    if (external) {
      return (
        <a href={href} className={cls} {...anchorRest}>
          {label}
        </a>
      );
    }
    return (
      <Link href={href} className={cls} {...anchorRest}>
        {label}
      </Link>
    );
  }

  const {
    variant: _variant,
    children: _children,
    className: _className,
    loading: _loading,
    disabled,
    type = "button",
    ...buttonRest
  } = props as Base & ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button type={type} className={cls} disabled={loading || disabled} {...buttonRest}>
      {loading ? "…" : children}
    </button>
  );
}
