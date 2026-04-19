/**
 * Tactile Button system — three clearly distinct variants.
 *
 * Tailwind v4 compatible: complex multi-value box-shadows are handled
 * entirely via framer-motion animate/whileHover/whileTap so they are
 * never parsed as Tailwind arbitrary values (which choke on commas).
 *
 * Primary:   Violet gradient, physically raised, glow on hover.
 * Secondary: Surface card feel, violet text, colored glow on hover.
 * Ghost:     Outlined, muted — accent color on hover.
 */
import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size    = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
}

// ─── Shadow values (kept out of Tailwind to avoid v4 comma-parsing issues) ────
const SHADOWS = {
  primary: {
    base:   'inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 16px rgba(109,40,217,0.45), 0 1px 3px rgba(0,0,0,0.4)',
    hover:  'inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 24px rgba(109,40,217,0.6), 0 2px 6px rgba(0,0,0,0.4)',
    active: 'inset 0 2px 4px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.3)',
  },
  secondary: {
    base:   'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.10), 0 1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.08)',
    hover:  'inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.12), 0 2px 0 rgba(0,0,0,0.06), 0 6px 20px rgba(124,58,237,0.22), 0 2px 6px rgba(0,0,0,0.08)',
    active: 'inset 0 2px 5px rgba(0,0,0,0.16), 0 1px 2px rgba(0,0,0,0.06)',
  },
  ghost: {
    base:   'inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 3px rgba(0,0,0,0.06)',
    hover:  'inset 0 1px 0 rgba(255,255,255,0.16), 0 4px 14px rgba(124,58,237,0.18)',
    active: 'inset 0 2px 4px rgba(0,0,0,0.12)',
  },
} satisfies Record<Variant, { base: string; hover: string; active: string }>

// ─── Base ─────────────────────────────────────────────────────────────────────
const BASE = cn(
  'inline-flex items-center justify-center gap-2 font-semibold select-none cursor-pointer',
  'transition-colors duration-150 ease-out',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg,_#fff)]',
  'disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none',
)

// ─── Variant classes (NO complex arbitrary shadows — those live in SHADOWS) ───
const VARIANTS: Record<Variant, string> = {
  primary: cn(
    'bg-gradient-to-b from-violet-500 to-violet-700 border border-violet-400/40 text-white',
    'hover:from-violet-400 hover:to-violet-600',
    'active:from-violet-600 active:to-violet-800',
  ),
  secondary: cn(
    'bg-[var(--color-surface-2)] border border-[var(--color-border)]',
    'text-violet-600 dark:text-violet-400',
    'hover:bg-[var(--color-surface)] hover:border-violet-400/50 dark:hover:border-violet-500/50',
  ),
  ghost: cn(
    'bg-transparent border border-[var(--color-border)] text-[var(--color-text-muted)]',
    'hover:bg-[var(--color-surface-2)] hover:border-violet-400/40 dark:hover:border-violet-500/40',
    'hover:text-violet-600 dark:hover:text-violet-400',
  ),
}

// ─── Sizes ────────────────────────────────────────────────────────────────────
const SIZES: Record<Size, string> = {
  sm: 'h-8  min-w-[2rem]   px-3  text-xs  rounded-md',
  md: 'h-9  min-w-[2.5rem] px-4  text-sm  rounded-md',
  lg: 'h-11 min-w-[3rem]   px-6  text-base rounded-lg',
}

// ─── Component ────────────────────────────────────────────────────────────────
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, icon, children, className, disabled, style, ...props }, ref) => {
    const isDisabled = disabled || loading
    const v = variant ?? 'secondary'
    const s = size ?? 'md'
    const shadows = SHADOWS[v]

    return (
      <motion.button
        ref={ref}
        disabled={isDisabled}
        className={cn(BASE, VARIANTS[v], SIZES[s], className)}
        // boxShadow animated by framer-motion — bypasses Tailwind v4 comma parsing
        animate={{ boxShadow: shadows.base }}
        whileHover={isDisabled ? {} : { boxShadow: shadows.hover,  y: -1, scale: 1.015 }}
        whileTap={isDisabled   ? {} : { boxShadow: shadows.active, y:  1, scale: 0.975 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={style}
        {...props}
      >
        {loading
          ? <Loader2 size={s === 'sm' ? 12 : 14} className="animate-spin shrink-0" />
          : icon && <span className="shrink-0 flex items-center">{icon}</span>
        }
        {children}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'