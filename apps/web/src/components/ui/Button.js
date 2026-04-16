import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
// ─── Base — shared across all variants ───────────────────────────────────────
const BASE = cn('inline-flex items-center justify-center gap-2 font-semibold select-none cursor-pointer', 'transition-all duration-150 ease-out', 
// Focus ring — always visible for keyboard users
'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d1a]', 
// Disabled
'disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none');
// ─── Variant styles ───────────────────────────────────────────────────────────
const VARIANTS = {
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
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_16px_rgba(109,40,217,0.45),0_1px_3px_rgba(0,0,0,0.4)]', 'text-white', 
    // Hover: lift + stronger glow
    'hover:from-violet-400 hover:to-violet-600', 'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_6px_24px_rgba(109,40,217,0.6),0_2px_6px_rgba(0,0,0,0.4)]', 'hover:-translate-y-px', 
    // Active: press down — shadow collapses, slight downward shift
    'active:translate-y-px active:from-violet-600 active:to-violet-800', 'active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_1px_2px_rgba(0,0,0,0.3)]'),
    /**
     * SECONDARY — glass/frosted, clearly clickable but visually subordinate.
     * Visual cues: border, backdrop blur, inner glow, hover brightens.
     */
    secondary: cn('bg-white/8 border border-white/18 text-white/80 backdrop-blur-sm', 'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.25)]', 
    // Hover: brighter glass
    'hover:bg-white/14 hover:border-white/28 hover:text-white', 'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_12px_rgba(0,0,0,0.3)]', 'hover:-translate-y-px', 
    // Active: press
    'active:translate-y-px active:bg-white/6 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]'),
    /**
     * GHOST — minimal, for utility/icon actions.
     * Visual cues: transparent bg, hover reveals subtle fill, always has focus ring.
     */
    ghost: cn('bg-transparent border border-transparent text-white/45', 'hover:bg-white/8 hover:border-white/10 hover:text-white/75', 'active:bg-white/5 active:translate-y-px'),
};
// ─── Size styles ──────────────────────────────────────────────────────────────
const SIZES = {
    sm: 'h-8  min-w-[2rem]  px-3   text-xs  rounded-lg',
    md: 'h-10 min-w-[2.5rem] px-5  text-sm  rounded-xl',
    lg: 'h-12 min-w-[3rem]  px-7   text-base rounded-xl',
};
// ─── Component ────────────────────────────────────────────────────────────────
export const Button = forwardRef(({ variant = 'secondary', size = 'md', loading, icon, children, className, disabled, ...props }, ref) => {
    const isDisabled = disabled || loading;
    return (_jsxs(motion.button, { ref: ref, disabled: isDisabled, className: cn(BASE, VARIANTS[variant], SIZES[size], className), 
        // Framer motion handles the scale — CSS handles translate for press feel
        whileHover: isDisabled ? {} : { scale: 1.015 }, whileTap: isDisabled ? {} : { scale: 0.975 }, transition: { type: 'spring', stiffness: 400, damping: 25 }, ...props, children: [loading
                ? _jsx(Loader2, { size: size === 'sm' ? 12 : 14, className: "animate-spin shrink-0" })
                : icon && _jsx("span", { className: "shrink-0 flex items-center", children: icon }), children] }));
});
Button.displayName = 'Button';
//# sourceMappingURL=Button.js.map