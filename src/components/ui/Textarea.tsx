import type { TextareaHTMLAttributes } from "react";

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  className?: string;
};

export function Textarea({ className = "", ...rest }: TextareaProps) {
  return <textarea className={["ds-input", "ds-focusable", className].filter(Boolean).join(" ")} {...rest} />;
}
