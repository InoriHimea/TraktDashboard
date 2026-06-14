/**
 * Tactile Button system — modern, 3D-raised, multi-color.
 *
 * Tailwind v4 compatible: complex multi-value box-shadows are handled
 * entirely via framer-motion animate/whileHover/whileTap so they are
 * never parsed as Tailwind arbitrary values (which choke on commas).
 *
 * Variants:
 *   Primary:   Gradient, physically raised, glow on hover.
 *   Secondary: Surface card feel, colored text, colored glow on hover.
 *   Ghost:     Outlined, muted — accent color on hover.
 *   Danger:    Red gradient for destructive actions.
 *
 * Colors: violet (default), emerald, rose, amber, sky, slate
 */
import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export type Variant = "primary" | "secondary" | "ghost" | "danger";
export type Size = "sm" | "md" | "lg";
export type Color = "cyan" | "violet" | "emerald" | "rose" | "amber" | "sky" | "slate";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
    variant?: Variant;
    size?: Size;
    color?: Color;
    loading?: boolean;
    icon?: ReactNode;
    children?: ReactNode;
}

// ─── Color palette ────────────────────────────────────────────────────────────
type ColorToken = {
    grad: string;
    glow: string;
    text: string;
    primaryText: string;
    bg: string;
    hoverBg: string;
    border: string;
    hoverBorder: string;
};

const COLOR_MAP: Record<Color, ColorToken> = {
    cyan: {
        grad: "linear-gradient(135deg, var(--action-cyan-solid) 0%, color-mix(in srgb, var(--action-cyan-solid), white 32%) 100%)",
        glow: "rgba(37,244,238,0.38)",
        text: "var(--action-cyan-text)",
        primaryText: "var(--action-cyan-primary-text)",
        bg: "var(--action-cyan-surface)",
        hoverBg: "var(--action-cyan-surface-hover)",
        border: "var(--action-cyan-border)",
        hoverBorder: "var(--action-cyan-border-hover)",
    },
    violet: {
        grad: "linear-gradient(135deg, var(--action-violet-solid) 0%, color-mix(in srgb, var(--action-violet-solid), white 28%) 100%)",
        glow: "rgba(139,92,246,0.34)",
        text: "var(--action-violet-text)",
        primaryText: "var(--action-violet-primary-text)",
        bg: "var(--action-violet-surface)",
        hoverBg: "var(--action-violet-surface-hover)",
        border: "var(--action-violet-border)",
        hoverBorder: "var(--action-violet-border-hover)",
    },
    emerald: {
        grad: "linear-gradient(135deg, var(--action-emerald-solid) 0%, color-mix(in srgb, var(--action-emerald-solid), white 26%) 100%)",
        glow: "rgba(49,245,168,0.30)",
        text: "var(--action-emerald-text)",
        primaryText: "var(--action-emerald-primary-text)",
        bg: "var(--action-emerald-surface)",
        hoverBg: "var(--action-emerald-surface-hover)",
        border: "var(--action-emerald-border)",
        hoverBorder: "var(--action-emerald-border-hover)",
    },
    rose: {
        grad: "linear-gradient(135deg, var(--action-rose-solid) 0%, color-mix(in srgb, var(--action-rose-solid), white 22%) 100%)",
        glow: "rgba(255,61,129,0.34)",
        text: "var(--action-rose-text)",
        primaryText: "var(--action-rose-primary-text)",
        bg: "var(--action-rose-surface)",
        hoverBg: "var(--action-rose-surface-hover)",
        border: "var(--action-rose-border)",
        hoverBorder: "var(--action-rose-border-hover)",
    },
    amber: {
        grad: "linear-gradient(135deg, var(--action-amber-solid) 0%, color-mix(in srgb, var(--action-amber-solid), white 24%) 100%)",
        glow: "rgba(248,211,92,0.28)",
        text: "var(--action-amber-text)",
        primaryText: "var(--action-amber-primary-text)",
        bg: "var(--action-amber-surface)",
        hoverBg: "var(--action-amber-surface-hover)",
        border: "var(--action-amber-border)",
        hoverBorder: "var(--action-amber-border-hover)",
    },
    sky: {
        grad: "linear-gradient(135deg, var(--action-sky-solid) 0%, color-mix(in srgb, var(--action-sky-solid), white 28%) 100%)",
        glow: "rgba(56,189,248,0.28)",
        text: "var(--action-sky-text)",
        primaryText: "var(--action-sky-primary-text)",
        bg: "var(--action-sky-surface)",
        hoverBg: "var(--action-sky-surface-hover)",
        border: "var(--action-sky-border)",
        hoverBorder: "var(--action-sky-border-hover)",
    },
    slate: {
        grad: "linear-gradient(135deg, var(--action-slate-solid) 0%, color-mix(in srgb, var(--action-slate-solid), white 34%) 100%)",
        glow: "rgba(143,179,199,0.20)",
        text: "var(--action-slate-text)",
        primaryText: "var(--action-slate-primary-text)",
        bg: "var(--action-slate-surface)",
        hoverBg: "var(--action-slate-surface-hover)",
        border: "var(--action-slate-border)",
        hoverBorder: "var(--action-slate-border-hover)",
    },
};

type ButtonStyle = CSSProperties & {
    "--button-bg"?: string;
    "--button-border"?: string;
    "--button-hover-bg"?: string;
    "--button-hover-border"?: string;
};

// ─── Shadow factory ───────────────────────────────────────────────────────────
function makeShadows(glow: string) {
    return {
        primary: {
            base: `inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 16px ${glow}, 0 1px 3px rgba(0,0,0,0.4)`,
            hover: `inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 24px ${glow.replace("0.45", "0.6")}, 0 2px 6px rgba(0,0,0,0.4)`,
            active: "inset 0 2px 4px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.3)",
        },
        danger: {
            base: `inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 16px rgba(225,29,72,0.45), 0 1px 3px rgba(0,0,0,0.4)`,
            hover: `inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 24px rgba(225,29,72,0.6), 0 2px 6px rgba(0,0,0,0.4)`,
            active: "inset 0 2px 4px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.3)",
        },
        secondary: {
            base: "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.10), 0 1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.08)",
            hover: `inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.12), 0 2px 0 rgba(0,0,0,0.06), 0 6px 20px ${glow.replace("0.45", "0.22").replace("0.35", "0.22")}, 0 2px 6px rgba(0,0,0,0.08)`,
            active: "inset 0 2px 5px rgba(0,0,0,0.16), 0 1px 2px rgba(0,0,0,0.06)",
        },
        ghost: {
            base: "inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 3px rgba(0,0,0,0.06)",
            hover: `inset 0 1px 0 rgba(255,255,255,0.16), 0 4px 14px ${glow.replace("0.45", "0.18").replace("0.35", "0.18")}, 0 1px 3px rgba(0,0,0,0.08)`,
            active: "inset 0 2px 4px rgba(0,0,0,0.12)",
        },
    } satisfies Record<Variant, { base: string; hover: string; active: string }>;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = "primary",
            size = "md",
            color = "cyan",
            loading = false,
            icon,
            children,
            style,
            ...props
        },
        ref,
    ) => {
        const activeColor = variant === "danger" ? "rose" : color;
        const token = COLOR_MAP[activeColor];
        const { grad, glow } = token;
        const shadows = makeShadows(glow);
        const currentShadows = shadows[variant];

        const commonClass = cn(
            "halo inline-flex items-center justify-center gap-2 font-semibold select-none cursor-pointer will-change-transform",
            "transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out",
            "focus-visible:outline-none",
            "disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none",
        );

        const variantClasses: Record<Variant, string> = {
            primary: "border border-[var(--button-border)]",
            danger: "border border-[var(--button-border)] text-white",
            secondary: cn(
                "border border-[var(--button-border)] bg-[var(--button-bg)]",
                "hover:border-[var(--button-hover-border)] hover:bg-[var(--button-hover-bg)]",
            ),
            ghost: cn(
                "border border-[var(--button-border)] bg-transparent",
                "hover:border-[var(--button-hover-border)] hover:bg-[var(--button-hover-bg)]",
            ),
        };

        const sizeClasses: Record<Size, string> = {
            sm: "h-9 min-w-[2.25rem] px-4 text-[13px] rounded-full",
            md: "h-11 min-w-[2.75rem] px-5 text-sm rounded-full",
            lg: "h-12 min-w-[3rem] px-6 text-base rounded-[0.75rem]",
        };

        const mergedStyle = {
            ...(style as CSSProperties | undefined),
            "--button-bg": token.bg,
            "--button-border": token.border,
            "--button-hover-bg": token.hoverBg,
            "--button-hover-border": token.hoverBorder,
        } as ButtonStyle;

        if (variant === "primary" || variant === "danger") {
            mergedStyle.background = grad;
            mergedStyle.color =
                variant === "danger" ? "var(--action-rose-primary-text)" : token.primaryText;
            mergedStyle["--button-border"] = "rgba(255,255,255,0.28)";
        } else if (variant === "secondary" || variant === "ghost") {
            mergedStyle.color = token.text;
        }

        return (
            <motion.button
                ref={ref}
                type="button"
                disabled={props.disabled || loading}
                className={cn(
                    commonClass,
                    variantClasses[variant],
                    sizeClasses[size],
                    loading && "pointer-events-none",
                    className,
                )}
                initial={{ boxShadow: currentShadows.base }}
                whileHover={{ boxShadow: currentShadows.hover, y: -1 }}
                whileTap={{ boxShadow: currentShadows.active, y: 0 }}
                animate={{ boxShadow: currentShadows.base, y: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={mergedStyle}
                {...props}
            >
                {loading && (
                    <Loader2
                        className={cn(
                            "h-4 w-4 animate-spin",
                            children && size === "lg" ? "mr-2" : "",
                        )}
                    />
                )}
                {icon && !loading && (
                    <span className={cn(children && size === "lg" ? "mr-2" : "")}>{icon}</span>
                )}
                {children}
            </motion.button>
        );
    },
);
Button.displayName = "Button";

export { Button };
