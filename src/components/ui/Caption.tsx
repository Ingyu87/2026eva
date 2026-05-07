import type { HTMLAttributes, ReactNode } from "react";

export type CaptionProps = Omit<HTMLAttributes<HTMLParagraphElement>, "className"> & {
  children: ReactNode;
  className?: string;
};

export function Caption({ children, className = "", ...rest }: CaptionProps) {
  return (
    <p className={["ds-caption", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </p>
  );
}
