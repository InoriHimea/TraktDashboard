import { cn } from "../../lib/utils";
import type { Color } from "./Button";

export type TagColor = Color | "zinc" | "neutral";

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: TagColor;
  variant?: "solid" | "outline" | "3d";
  size?: "sm" | "md";
  icon?: React.ReactNode;
}

const TAG_COLORS: Record<TagColor, { solid: string; outline: string; shadow: string; text: string }> = {
  cyan: {
    solid: "bg-cyan-300 text-cyan-950",
    outline: "border-cyan-300/30 text-cyan-200 bg-cyan-300/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),_0_0_18px_rgba(37,244,238,0.20)] bg-gradient-to-b from-cyan-300 to-cyan-500 text-cyan-950 border-cyan-200/40",
    text: "text-cyan-300",
  },
  violet: {
    solid: "bg-violet-500 text-white",
    outline: "border-violet-400/30 text-violet-200 bg-violet-500/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_0_18px_rgba(139,92,246,0.22)] bg-gradient-to-b from-violet-500 to-violet-700 text-white border-violet-300/30",
    text: "text-violet-500",
  },
  emerald: {
    solid: "bg-emerald-400 text-emerald-950",
    outline: "border-emerald-400/30 text-emerald-200 bg-emerald-500/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_0_18px_rgba(49,245,168,0.20)] bg-gradient-to-b from-emerald-300 to-emerald-500 text-emerald-950 border-emerald-200/30",
    text: "text-emerald-500",
  },
  rose: {
    solid: "bg-rose-500 text-white",
    outline: "border-rose-400/30 text-rose-200 bg-rose-500/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_0_18px_rgba(255,61,129,0.22)] bg-gradient-to-b from-rose-400 to-rose-600 text-white border-rose-300/30",
    text: "text-rose-500",
  },
  amber: {
    solid: "bg-amber-300 text-amber-950",
    outline: "border-amber-300/30 text-amber-200 bg-amber-500/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_0_18px_rgba(248,211,92,0.18)] bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 border-amber-200/30",
    text: "text-amber-500",
  },
  sky: {
    solid: "bg-sky-400 text-sky-950",
    outline: "border-sky-400/30 text-sky-200 bg-sky-500/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_0_18px_rgba(56,189,248,0.18)] bg-gradient-to-b from-sky-300 to-sky-500 text-sky-950 border-sky-200/30",
    text: "text-sky-500",
  },
  slate: {
    solid: "bg-slate-500 text-white",
    outline: "border-slate-400/25 text-slate-200 bg-slate-500/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.16),_0_0_14px_rgba(143,179,199,0.12)] bg-gradient-to-b from-slate-500 to-slate-700 text-white border-slate-300/25",
    text: "text-slate-500",
  },
  zinc: {
    solid: "bg-zinc-500 text-white",
    outline: "border-zinc-500/30 text-zinc-600 dark:text-zinc-400 bg-zinc-500/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(113,113,122,0.3)] bg-gradient-to-b from-zinc-500 to-zinc-600 text-white border-zinc-700/50",
    text: "text-zinc-500",
  },
  neutral: {
    solid: "bg-neutral-500 text-white",
    outline: "border-neutral-500/30 text-neutral-600 dark:text-neutral-400 bg-neutral-500/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(115,115,115,0.3)] bg-gradient-to-b from-neutral-500 to-neutral-600 text-white border-neutral-700/50",
    text: "text-neutral-500",
  },
};

export function Tag({
  color = "slate",
  variant = "3d",
  size = "md",
  icon,
  className,
  children,
  ...props
}: TagProps) {
  const colorStyles = TAG_COLORS[color];

  const variantClasses = {
    solid: colorStyles.solid,
    outline: cn("border", colorStyles.outline),
    "3d": cn("border", colorStyles.shadow),
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {icon && (
        <span className={cn("shrink-0", variant === "3d" ? "text-white/80" : "")}>
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
