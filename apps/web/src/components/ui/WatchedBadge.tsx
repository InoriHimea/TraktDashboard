import { t } from "../../lib/i18n";

/**
 * WatchedBadge —— 全站统一的「已观看 / Watched」标注。
 *
 * 视觉规范（唯一来源）：
 *   - 图标：Trakt 风格的「双勾」(double check)。
 *   - 配色：emerald 玻璃拟态药丸，与 --color-watched 语义一致。
 *   - 用于海报 / 剧照之上时，由父级用绝对定位容器决定位置（角标或居中）。
 *
 * 所有详情页、卡片的已观看标注都应复用本组件，禁止再各自手写。
 */

const SIZES = {
    sm: {
        padding: "4px 10px",
        gap: "5px",
        icon: { w: 13, h: 9 },
        font: "9px",
    },
    md: {
        padding: "6px 14px",
        gap: "6px",
        icon: { w: 15, h: 11 },
        font: "10px",
    },
} as const;

interface WatchedBadgeProps {
    /** 视觉尺寸：卡片角标用 sm，详情页用 md。默认 md。 */
    size?: keyof typeof SIZES;
    /** 覆盖默认文案（默认取 common.watched）。 */
    label?: string;
    className?: string;
}

export function WatchedBadge({ size = "md", label, className }: WatchedBadgeProps) {
    const s = SIZES[size];
    const text = label ?? t("common.watched");

    return (
        <div
            className={className}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: s.gap,
                padding: s.padding,
                borderRadius: "99px",
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow:
                    "0 0 0 1px rgba(52,211,153,0.55), 0 0 0 3px rgba(52,211,153,0.12), inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 12px rgba(0,0,0,0.4)",
                border: "1px solid rgba(52,211,153,0.7)",
            }}
        >
            {/* Trakt 风格双勾 */}
            <svg
                width={s.icon.w}
                height={s.icon.h}
                viewBox="0 0 30 22"
                fill="none"
                style={{ color: "#34d399", flexShrink: 0 }}
                aria-hidden="true"
            >
                <path
                    d="M2 11L8 17L18 6"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M11 11L17 17L27 6"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            <span
                style={{
                    fontSize: s.font,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    color: "#34d399",
                    textTransform: "uppercase",
                }}
            >
                {text}
            </span>
        </div>
    );
}
