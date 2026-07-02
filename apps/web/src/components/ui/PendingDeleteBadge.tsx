import { Trash2, X } from "lucide-react";
import { useDeferJellyfinDelete } from "../../hooks";
import { t } from "../../lib/i18n";
import { useToast } from "../../lib/toast";

interface PendingDeleteBadgeProps {
    queueId: number;
    label: string;
    className?: string;
}

/**
 * 待自动删除角标 —— 展示条目已进入 Jellyfin 两阶段自动删除队列。
 * 角标上的 X = 推迟 7 天（软取消，到期后重新进入两段式流程）；
 * "永不删除"入口在设置页队列面板和剧集详情页开关。
 * 用于卡片海报之上，由父级绝对定位容器决定位置。
 */
export function PendingDeleteBadge({ queueId, label, className }: PendingDeleteBadgeProps) {
    const { mutate: defer, isPending } = useDeferJellyfinDelete();
    const { toast } = useToast();

    function handleDefer(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        defer(queueId, {
            onSuccess: () => toast(t("media.pendingDeleteDeferSuccess"), "success"),
            onError: () => toast(t("media.pendingDeleteCancelFailed"), "error"),
        });
    }

    return (
        <div
            className={className}
            onClick={(e) => e.preventDefault()}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 6px 4px 10px",
                borderRadius: "99px",
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow:
                    "0 0 0 1px rgba(248,113,113,0.55), 0 0 0 3px rgba(248,113,113,0.12), inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 12px rgba(0,0,0,0.4)",
                border: "1px solid rgba(248,113,113,0.7)",
            }}
        >
            <Trash2 size={10} style={{ color: "#f87171", flexShrink: 0 }} />
            <span
                style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    color: "#f87171",
                    whiteSpace: "nowrap",
                }}
            >
                {label}
            </span>
            <button
                type="button"
                disabled={isPending}
                onClick={handleDefer}
                title={t("media.pendingDeleteDefer")}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    border: "none",
                    background: "rgba(255,255,255,0.12)",
                    color: "#f87171",
                    cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.5 : 1,
                    flexShrink: 0,
                }}
            >
                <X size={9} />
            </button>
        </div>
    );
}
