import type { InputHTMLAttributes } from "react";

export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  className?: string;
};

export function TextInput({ className = "", ...rest }: TextInputProps) {
  return <input className={["ds-input", "ds-focusable", className].filter(Boolean).join(" ")} {...rest} />;
}
