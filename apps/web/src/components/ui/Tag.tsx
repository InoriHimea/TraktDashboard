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
  violet: {
    solid: "bg-violet-500 text-white",
    outline: "border-violet-500/30 text-violet-600 dark:text-violet-400 bg-violet-500/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(139,92,246,0.3)] bg-gradient-to-b from-violet-500 to-violet-600 text-white border-violet-700/50",
    text: "text-violet-500",
  },
  emerald: {
    solid: "bg-emerald-500 text-white",
    outline: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(16,185,129,0.3)] bg-gradient-to-b from-emerald-500 to-emerald-600 text-white border-emerald-700/50",
    text: "text-emerald-500",
  },
  rose: {
    solid: "bg-rose-500 text-white",
    outline: "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(244,63,94,0.3)] bg-gradient-to-b from-rose-500 to-rose-600 text-white border-rose-700/50",
    text: "text-rose-500",
  },
  amber: {
    solid: "bg-amber-500 text-white",
    outline: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(245,158,11,0.3)] bg-gradient-to-b from-amber-500 to-amber-600 text-white border-amber-700/50",
    text: "text-amber-500",
  },
  sky: {
    solid: "bg-sky-500 text-white",
    outline: "border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(14,165,233,0.3)] bg-gradient-to-b from-sky-500 to-sky-600 text-white border-sky-700/50",
    text: "text-sky-500",
  },
  slate: {
    solid: "bg-slate-500 text-white",
    outline: "border-slate-500/30 text-slate-600 dark:text-slate-400 bg-slate-500/10",
    shadow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(100,116,139,0.3)] bg-gradient-to-b from-slate-500 to-slate-600 text-white border-slate-700/50",
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
