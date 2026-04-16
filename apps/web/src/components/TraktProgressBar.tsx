import { motion } from "framer-motion";
import { cn } from "../lib/utils";

interface TraktProgressBarProps {
    watched: number;
    total: number;
    className?: string;
}

export function TraktProgressBar({
    watched,
    total,
    className,
}: TraktProgressBarProps) {
    const pct =
        total === 0 ? 0 : Math.min(100, Math.max(0, (watched / total) * 100));

    return (
        <div
            className={cn(
                "bg-neutral-800 rounded-full h-2 w-full overflow-hidden",
                className,
            )}
        >
            <motion.div
                className="bg-violet-500 rounded-full h-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
        </div>
    );
}
