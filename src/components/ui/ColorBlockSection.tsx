import type { HTMLAttributes, ReactNode } from "react";

export type ColorBlockTone = "lime" | "lilac" | "cream" | "mint" | "pink" | "coral" | "navy";

export type ColorBlockSectionProps = HTMLAttributes<HTMLElement> & {
  tone: ColorBlockTone;
  children: ReactNode;
};

const toneClass: Record<ColorBlockTone, string> = {
  lime: "ds-color-block--lime",
  lilac: "ds-color-block--lilac",
  cream: "ds-color-block--cream",
  mint: "ds-color-block--mint",
  pink: "ds-color-block--pink",
  coral: "ds-color-block--coral",
  navy: "ds-color-block--navy"
};

export function ColorBlockSection({ tone, children, className = "", ...rest }: ColorBlockSectionProps) {
  const cls = ["ds-color-block", toneClass[tone], className].filter(Boolean).join(" ");
  return (
    <section className={cls} {...rest}>
      {children}
    </section>
  );
}
