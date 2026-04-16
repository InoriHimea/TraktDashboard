import { jsx as _jsx } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
export function TraktProgressBar({ watched, total, className, }) {
    const pct = total === 0 ? 0 : Math.min(100, Math.max(0, (watched / total) * 100));
    return (_jsx("div", { className: cn("bg-neutral-800 rounded-full h-2 w-full overflow-hidden", className), children: _jsx(motion.div, { className: "bg-violet-500 rounded-full h-full", initial: { width: 0 }, animate: { width: `${pct}%` }, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } }) }));
}
//# sourceMappingURL=TraktProgressBar.js.map