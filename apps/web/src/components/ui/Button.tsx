/**
 * Tactile Button system — three clearly distinct variants.
 *
 * Primary:   High-contrast violet gradient, top highlight, bottom shadow, glow on hover.
 *            Visually "raised" — the most important action on the page.
 *
 * Secondary: Glass/frosted border, subtle inner glow, clearly clickable but subordinate.
 *            Used for supporting actions (bookmark, add to list, etc.)
 *
 * Ghost:     Transparent, minimal. Used for utility/icon actions.
 *            Has hover background and focus ring so it never looks like plain text.
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

// ─── Base — shared across all variants ───────────────────────────────────────
const BASE = cn(
  'inline-flex items-center justify-center gap-2 font-semibold select-none cursor-pointer',
  'transition-all duration-150 ease-out',
  // Focus ring — always visible for keyboard users
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d1a]',
  // Disabled
  'disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none',
)

// ─── Variant styles ───────────────────────────────────────────────────────────
const VARIANTS: Record<Variant, string> = {
  /**
   * PRIMARY — raised, glowing, unmistakably the main action.
   * Visual cues: gradient fill, top-edge highlight, bottom shadow, hover glow.
   */
  primary: cn(
    // Fill: violet gradient
    'bg-gradient-to-b from-violet-500 to-violet-700',
    // Top highlight line (simulates light hitting the top edge)
    'border border-violet-400/40',
    // Inset top highlight
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_16px_rgba(109,40,217,0.45),0_1px_3px_rgba(0,0,0,0.4)]',
    'text-white',
    // Hover: lift + stronger glow
    'hover:from-violet-400 hover:to-violet-600',
    'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_6px_24px_rgba(109,40,217,0.6),0_2px_6px_rgba(0,0,0,0.4)]',
    'hover:-translate-y-px',
    // Active: press down — shadow collapses, slight downward shift
    'active:translate-y-px active:from-violet-600 active:to-violet-800',
    'active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_1px_2px_rgba(0,0,0,0.3)]',
  ),

  /**
   * SECONDARY — raised, vibrant accent text, 3D depth.
   * Uses accent color for text to add vibrancy on any background.
   */
  secondary: cn(
    'bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-accent,#7c3aed)]',
    // 3D: top highlight + bottom shadow + soft lift
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.1),0_1px_0_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.08),0_0_0_1px_rgba(124,58,237,0.06)]',
    // Hover: violet border tint + lift + colored glow
    'hover:bg-[var(--color-surface)] hover:border-[rgba(124,58,237,0.35)] hover:-translate-y-px',
    'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.12),0_2px_0_rgba(0,0,0,0.06),0_6px_20px_rgba(124,58,237,0.15),0_2px_6px_rgba(0,0,0,0.08)]',
    'active:translate-y-px active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.14),0_1px_2px_rgba(0,0,0,0.06)]',
  ),

  /**
   * GHOST — outlined, muted but with accent on hover.
   */
  ghost: cn(
    'bg-transparent border border-[var(--color-border)] text-[var(--color-text-muted)]',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_3px_rgba(0,0,0,0.06)]',
    'hover:bg-[var(--color-surface-2)] hover:border-[rgba(124,58,237,0.3)] hover:text-[var(--color-accent,#7c3aed)] hover:-translate-y-px',
    'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_4px_12px_rgba(124,58,237,0.12)]',
    'active:translate-y-px active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]',
  ),
}

// ─── Size styles ──────────────────────────────────────────────────────────────
const SIZES: Record<Size, string> = {
  sm: 'h-8  min-w-[2rem]  px-3   text-xs  rounded-md',
  md: 'h-9  min-w-[2.5rem] px-4  text-sm  rounded-md',
  lg: 'h-11 min-w-[3rem]  px-6   text-base rounded-lg',
}

// ─── Component ────────────────────────────────────────────────────────────────
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, icon, children, className, disabled, ...props }, ref) => {
    const isDisabled = disabled || loading

    return (
      <motion.button
        ref={ref}
        disabled={isDisabled}
        className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
        // Framer motion handles the scale — CSS handles translate for press feel
        whileHover={isDisabled ? {} : { scale: 1.015 }}
        whileTap={isDisabled ? {} : { scale: 0.975 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        {...props}
      >
        {loading
          ? <Loader2 size={size === 'sm' ? 12 : 14} className="animate-spin shrink-0" />
          : icon && <span className="shrink-0 flex items-center">{icon}</span>
        }
        {children}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'