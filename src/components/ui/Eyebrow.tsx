import type { HTMLAttributes, ReactNode } from "react";

export type EyebrowProps = Omit<HTMLAttributes<HTMLParagraphElement>, "className"> & {
  children: ReactNode;
  className?: string;
};

export function Eyebrow({ children, className = "", ...rest }: EyebrowProps) {
  return (
    <p className={["ds-eyebrow", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </p>
  );
}
