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
export type Color   = 'cyan' | 'violet' | 'emerald' | 'rose' | 'amber' | 'sky' | 'slate'

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
  cyan:    { grad: 'linear-gradient(135deg, var(--color-accent) 0%, #8dfcff 100%)', glow: 'rgba(37,244,238,0.45)', text: 'var(--color-accent-light)', ring: 'focus-visible:ring-cyan-300' },
  violet:  { grad: 'linear-gradient(135deg, var(--color-accent-violet) 0%, #c4b5fd 100%)', glow: 'rgba(139,92,246,0.42)', text: '#c4b5fd', ring: 'focus-visible:ring-violet-400' },
  emerald: { grad: 'linear-gradient(135deg, #06b981 0%, var(--color-watched) 100%)', glow: 'rgba(49,245,168,0.36)',  text: 'var(--color-watched)', ring: 'focus-visible:ring-emerald-300' },
  rose:    { grad: 'linear-gradient(135deg, #e11d48 0%, var(--color-accent-rose) 100%)', glow: 'rgba(255,61,129,0.42)',  text: 'var(--color-accent-rose)', ring: 'focus-visible:ring-rose-400' },
  amber:   { grad: 'linear-gradient(135deg, #d97706 0%, var(--color-airing) 100%)', glow: 'rgba(248,211,92,0.34)',  text: 'var(--color-airing)',  ring: 'focus-visible:ring-amber-300' },
  sky:     { grad: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)', glow: 'rgba(56,189,248,0.34)',  text: '#7dd3fc',  ring: 'focus-visible:ring-sky-300' },
  slate:   { grad: 'linear-gradient(135deg, #314456 0%, #8fb3c7 100%)', glow: 'rgba(143,179,199,0.24)',  text: 'var(--color-text-secondary)',  ring: 'focus-visible:ring-slate-300' },
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
      color = 'cyan',
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
        'border border-white/20',
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
      if (variant === 'primary') {
        mergedStyle.color = ['cyan', 'emerald', 'amber', 'sky'].includes(activeColor) ? '#001316' : '#fff'
      }
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
