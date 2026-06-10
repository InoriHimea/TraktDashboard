import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/utils";
import type { Color } from "./Button";

export type TagColor = Color | "zinc" | "neutral";

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: TagColor;
  variant?: "solid" | "outline" | "3d";
  size?: "sm" | "md";
  icon?: ReactNode;
}

const TAG_COLOR_VARS: Record<TagColor, { text: string; solid: string; solidText: string }> = {
  cyan: { text: "var(--action-cyan-text)", solid: "var(--action-cyan-solid)", solidText: "var(--action-cyan-primary-text)" },
  violet: { text: "var(--action-violet-text)", solid: "var(--action-violet-solid)", solidText: "var(--action-violet-primary-text)" },
  emerald: { text: "var(--action-emerald-text)", solid: "var(--action-emerald-solid)", solidText: "var(--action-emerald-primary-text)" },
  rose: { text: "var(--action-rose-text)", solid: "var(--action-rose-solid)", solidText: "var(--action-rose-primary-text)" },
  amber: { text: "var(--action-amber-text)", solid: "var(--action-amber-solid)", solidText: "var(--action-amber-primary-text)" },
  sky: { text: "var(--action-sky-text)", solid: "var(--action-sky-solid)", solidText: "var(--action-sky-primary-text)" },
  slate: { text: "var(--action-slate-text)", solid: "var(--action-slate-solid)", solidText: "var(--action-slate-primary-text)" },
  zinc: { text: "var(--color-text-secondary)", solid: "var(--color-surface-4)", solidText: "var(--color-text)" },
  neutral: { text: "var(--color-text-secondary)", solid: "var(--color-surface-4)", solidText: "var(--color-text)" },
};

type TagStyle = CSSProperties & {
  "--tag-color"?: string;
  "--tag-solid"?: string;
  "--tag-solid-text"?: string;
};

export function Tag({
  color = "slate",
  variant = "3d",
  size = "md",
  icon,
  className,
  style,
  children,
  ...props
}: TagProps) {
  const colorVars = TAG_COLOR_VARS[color];

  const variantClasses = {
    solid: "border border-transparent bg-[var(--tag-solid)] text-[var(--tag-solid-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]",
    outline: "border border-[color-mix(in_srgb,var(--tag-color)_34%,transparent)] bg-[color-mix(in_srgb,var(--tag-color)_10%,transparent)] text-[var(--tag-color)]",
    "3d": cn(
      "border border-[color-mix(in_srgb,var(--tag-color)_30%,transparent)] text-[var(--tag-color)]",
      "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--tag-color)_14%,var(--color-surface)),color-mix(in_srgb,var(--tag-color)_7%,var(--color-surface-2)))]",
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.08)]",
    ),
  };

  const sizeClasses = {
    sm: "px-2.5 py-1 text-[11px] gap-1",
    md: "px-3 py-1.5 text-xs gap-1.5",
  };

  const tagStyle = {
    ...(style as CSSProperties | undefined),
    "--tag-color": colorVars.text,
    "--tag-solid": colorVars.solid,
    "--tag-solid-text": colorVars.solidText,
  } as TagStyle;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      style={tagStyle}
      {...props}
    >
      {icon && (
        <span className="shrink-0">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
