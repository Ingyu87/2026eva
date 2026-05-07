import type { SelectHTMLAttributes } from "react";

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
  className?: string;
};

export function Select({ className = "", ...rest }: SelectProps) {
  return <select className={["ds-input", "ds-focusable", className].filter(Boolean).join(" ")} {...rest} />;
}
