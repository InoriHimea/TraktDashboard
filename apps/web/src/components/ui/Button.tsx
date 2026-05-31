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
import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type Size    = 'sm' | 'md' | 'lg'
export type Color   = 'violet' | 'emerald' | 'rose' | 'amber' | 'sky' | 'slate'

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant
  size?: Size
  color?: Color
  loading?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
}

// ─── Color palette ────────────────────────────────────────────────────────────
const COLOR_MAP: Record<Color, { grad: string; glow: string; text: string; ring: string }> = {
  violet:  { grad: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)', glow: 'rgba(109,40,217,0.45)', text: 'hsl(270 93% 64%)', ring: 'focus-visible:ring-violet-400' },
  emerald: { grad: 'linear-gradient(135deg, #059669 0%, #34d399 100%)', glow: 'rgba(5,150,105,0.45)',  text: 'hsl(160 84% 60%)', ring: 'focus-visible:ring-emerald-400' },
  rose:    { grad: 'linear-gradient(135deg, #e11d48 0%, #fb7185 100%)', glow: 'rgba(225,29,72,0.45)',  text: 'hsl(350 78% 68%)', ring: 'focus-visible:ring-rose-400' },
  amber:   { grad: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)', glow: 'rgba(217,119,6,0.45)',  text: 'hsl(38 92% 64%)',  ring: 'focus-visible:ring-amber-400' },
  sky:     { grad: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)', glow: 'rgba(2,132,199,0.45)',  text: 'hsl(200 90% 64%)',  ring: 'focus-visible:ring-sky-400' },
  slate:   { grad: 'linear-gradient(135deg, #475569 0%, #94a3b8 100%)', glow: 'rgba(71,85,105,0.35)',  text: 'hsl(220 14% 64%)',  ring: 'focus-visible:ring-slate-400' },
}

// ─── Shadow factory ───────────────────────────────────────────────────────────
function makeShadows(glow: string) {
  return {
    primary: {
      base:   `inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 16px ${glow}, 0 1px 3px rgba(0,0,0,0.4)`,
      hover:  `inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 24px ${glow.replace('0.45', '0.6')}, 0 2px 6px rgba(0,0,0,0.4)`,
      active: 'inset 0 2px 4px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.3)',
    },
    danger: {
      base:   `inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 16px rgba(225,29,72,0.45), 0 1px 3px rgba(0,0,0,0.4)`,
      hover:  `inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 24px rgba(225,29,72,0.6), 0 2px 6px rgba(0,0,0,0.4)`,
      active: 'inset 0 2px 4px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.3)',
    },
    secondary: {
      base:   'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.10), 0 1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.08)',
      hover:  `inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.12), 0 2px 0 rgba(0,0,0,0.06), 0 6px 20px ${glow.replace('0.45', '0.22').replace('0.35', '0.22')}, 0 2px 6px rgba(0,0,0,0.08)`,
      active: 'inset 0 2px 5px rgba(0,0,0,0.16), 0 1px 2px rgba(0,0,0,0.06)',
    },
    ghost: {
      base:   'inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 3px rgba(0,0,0,0.06)',
      hover:  `inset 0 1px 0 rgba(255,255,255,0.16), 0 4px 14px ${glow.replace('0.45', '0.18').replace('0.35', '0.18')}, 0 1px 3px rgba(0,0,0,0.08)`,
      active: 'inset 0 2px 4px rgba(0,0,0,0.12)',
    },
  } satisfies Record<Variant, { base: string; hover: string; active: string }>
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      color = 'violet',
      loading = false,
      icon,
      children,
      style,
      ...props
    },
    ref,
  ) => {
    const activeColor = variant === 'danger' ? 'rose' : color
    const { grad, glow, text: textColor, ring: ringClass } = COLOR_MAP[activeColor]
    const shadows = makeShadows(glow)
    const currentShadows = shadows[variant]

    const commonClass = cn(
      'inline-flex items-center justify-center gap-2 font-semibold select-none cursor-pointer will-change-transform',
      'transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none',
    )

    const variantClasses: Record<Variant, string> = {
      primary: cn(
        'border border-white/20 text-white',
        ringClass, 'focus-visible:ring-offset-[var(--color-bg)]',
      ),
      danger: cn(
        'border border-white/20 text-white',
        `focus-visible:ring-rose-400 focus-visible:ring-offset-[var(--color-bg)]`,
      ),
      secondary: cn(
        'bg-[var(--color-surface-2)] border border-[var(--color-border)]',
        `hover:bg-[var(--color-surface)]`,
        ringClass, 'focus-visible:ring-offset-[var(--color-bg)]',
      ),
      ghost: cn(
        'bg-transparent border border-[var(--color-border)] text-[var(--color-text-muted)]',
        `hover:bg-[var(--color-surface-2)] hover:border-white/20`,
        ringClass, 'focus-visible:ring-offset-[var(--color-bg)]',
      ),
    }

    const sizeClasses: Record<Size, string> = {
      sm: 'h-8 min-w-[2rem] px-4 text-xs rounded-full',
      md: 'h-10 min-w-[2.5rem] px-5 text-sm rounded-full',
      lg: 'h-12 min-w-[3rem] px-6 text-base rounded-[0.75rem]',
    }

    const mergedStyle = {
      ...(style as React.CSSProperties | undefined),
    } as React.CSSProperties

    if (variant === 'primary' || variant === 'danger') {
      mergedStyle.background = grad
    } else if (variant === 'secondary' || variant === 'ghost') {
      mergedStyle.color = textColor
    }

    return (
      <motion.button
        ref={ref}
        type="button"
        disabled={props.disabled || loading}
        className={cn(commonClass, variantClasses[variant], sizeClasses[size], loading && 'pointer-events-none', className)}
        initial={{ boxShadow: currentShadows.base }}
        whileHover={{ boxShadow: currentShadows.hover, y: -1 }}
        whileTap={{ boxShadow: currentShadows.active, y: 0 }}
        animate={{ boxShadow: currentShadows.base, y: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={mergedStyle}
        {...props}
      >
        {loading && <Loader2 className={cn('h-4 w-4 animate-spin', children && size === 'lg' ? 'mr-2' : '')} />}
        {icon && !loading && (
          <span className={cn(children && size === 'lg' ? 'mr-2' : '')}>{icon}</span>
        )}
        {children}
      </motion.button>
    )
  },
)
Button.displayName = 'Button'

export { Button }
