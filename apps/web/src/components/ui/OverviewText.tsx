import { useState } from "react";
import { cn } from "../../lib/utils";
import { t } from "../../lib/i18n";
import { Button } from "./Button";

interface OverviewTextProps {
    text: string | null;
    className?: string;
    lineClamp?: number;
}

export function OverviewText({ text, className, lineClamp = 4 }: OverviewTextProps) {
    const [expanded, setExpanded] = useState(false);
    const [clamped, setClamped] = useState(false);

    function handleRef(el: HTMLParagraphElement | null) {
        if (el && !expanded) setClamped(el.scrollHeight > el.clientHeight + 2);
    }

    if (!text) return null;

    return (
        <div>
            <p
                ref={handleRef}
                className={cn(
                    "text-[14px] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line",
                    className,
                )}
                style={
                    expanded
                        ? undefined
                        : {
                              display: "-webkit-box",
                              WebkitLineClamp: lineClamp,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                          }
                }
            >
                {text}
            </p>
            {clamped && (
                <Button
                    type="button"
                    variant="ghost"
                    color="slate"
                    size="sm"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-2"
                >
                    {expanded ? t("common.collapse") : t("common.readMore")}
                </Button>
            )}
        </div>
    );
}
