import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, List, Trash2, RefreshCw, Loader2, Globe, Lock, Users, X, Check } from "lucide-react";
import {
    useLists,
    useListItems,
    useCreateList,
    useDeleteList,
    useSyncLists,
    useRemoveListItem,
} from "../hooks";
import { tmdbImage } from "../lib/image";
import { t } from "../lib/i18n";
import type { UserList } from "@trakt-dashboard/types";

const PRIVACY_ICONS = {
    private: Lock,
    friends: Users,
    public: Globe,
};

function PrivacyBadge({ privacy }: { privacy: UserList["privacy"] }) {
    const Icon = PRIVACY_ICONS[privacy] ?? Lock;
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                fontSize: "10px",
                color: "var(--color-text-muted)",
                background: "var(--color-surface-2)",
                borderRadius: "4px",
                padding: "2px 6px",
            }}
        >
            <Icon size={9} />
            {t(`lists.privacy.${privacy}`)}
        </span>
    );
}

function CreateListModal({ onClose }: { onClose: () => void }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [privacy, setPrivacy] = useState<"private" | "friends" | "public">("private");
    const create = useCreateList();

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) return;
        create.mutate(
            { name: name.trim(), description: description.trim() || undefined, privacy },
            {
                onSuccess: () => onClose(),
            },
        );
    }

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 60,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(4px)",
            }}
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: "var(--color-surface)",
                    borderRadius: "16px",
                    border: "1px solid var(--color-border-subtle)",
                    padding: "24px",
                    width: "min(420px, 92vw)",
                    boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "20px",
                    }}
                >
                    <h2
                        style={{
                            margin: 0,
                            fontSize: "16px",
                            fontWeight: 700,
                            color: "var(--color-text)",
                        }}
                    >
                        {t("lists.createTitle")}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--color-text-muted)",
                            padding: 4,
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    style={{ display: "flex", flexDirection: "column", gap: "14px" }}
                >
                    <div>
                        <label
                            style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "var(--color-text-muted)",
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                display: "block",
                                marginBottom: "6px",
                            }}
                        >
                            {t("lists.nameLabel")}
                        </label>
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={255}
                            placeholder={t("lists.namePlaceholder")}
                            style={{
                                width: "100%",
                                boxSizing: "border-box",
                                padding: "9px 12px",
                                borderRadius: "8px",
                                border: "1px solid var(--color-border-subtle)",
                                background: "var(--color-bg)",
                                color: "var(--color-text-base)",
                                fontSize: "14px",
                                fontFamily: "inherit",
                                outline: "none",
                            }}
                            onFocus={(e) =>
                                (e.currentTarget.style.borderColor = "var(--color-accent)")
                            }
                            onBlur={(e) =>
                                (e.currentTarget.style.borderColor = "var(--color-border-subtle)")
                            }
                        />
                    </div>

                    <div>
                        <label
                            style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "var(--color-text-muted)",
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                display: "block",
                                marginBottom: "6px",
                            }}
                        >
                            {t("lists.descLabel")}
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={500}
                            rows={2}
                            placeholder={t("lists.descPlaceholder")}
                        />
                    </div>

                    <div>
                        <label
                            style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "var(--color-text-muted)",
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                display: "block",
                                marginBottom: "6px",
                            }}
                        >
                            {t("lists.privacyLabel")}
                        </label>
                        <div style={{ display: "flex", gap: "6px" }}>
                            {(["private", "friends", "public"] as const).map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPrivacy(p)}
                                    style={{
                                        flex: 1,
                                        padding: "7px 10px",
                                        borderRadius: "7px",
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                        border:
                                            privacy === p
                                                ? "1px solid var(--color-accent)"
                                                : "1px solid var(--color-border-subtle)",
                                        background:
                                            privacy === p ? "rgba(37,244,238,0.08)" : "transparent",
                                        color:
                                            privacy === p
                                                ? "var(--color-accent)"
                                                : "var(--color-text-muted)",
                                        transition: "all 0.15s",
                                    }}
                                >
                                    {t(`lists.privacy.${p}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={!name.trim() || create.isPending}
                        style={{
                            marginTop: "4px",
                            padding: "10px",
                            borderRadius: "8px",
                            background: "var(--color-accent)",
                            color: "#000",
                            border: "none",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: name.trim() ? "pointer" : "default",
                            opacity: !name.trim() ? 0.4 : 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            transition: "opacity 0.15s",
                        }}
                    >
                        {create.isPending ? (
                            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                        ) : (
                            <Check size={14} />
                        )}
                        {t("lists.createConfirm")}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}

export default function ListsPage() {
    const { data: lists, isLoading: listsLoading } = useLists();
    const [selectedListId, setSelectedListId] = useState<number | null>(null);
    const { data: items, isLoading: itemsLoading } = useListItems(selectedListId);
    const deleteList = useDeleteList();
    const syncLists = useSyncLists();
    const removeItem = useRemoveListItem();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

    const selectedList = lists?.find((l) => l.id === selectedListId);

    return (
        <div
            style={{
                minHeight: "100vh",
                paddingTop: "var(--app-nav-height)",
                display: "flex",
                maxWidth: "1400px",
                margin: "0 auto",
            }}
        >
            {/* Sidebar */}
            <aside
                style={{
                    width: "260px",
                    flexShrink: 0,
                    borderRight: "1px solid var(--color-border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    padding: "20px 0",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0 16px 12px",
                    }}
                >
                    <h2
                        style={{
                            margin: 0,
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "var(--color-text)",
                        }}
                    >
                        {t("lists.title")}
                    </h2>
                    <div style={{ display: "flex", gap: "4px" }}>
                        <button
                            onClick={() => syncLists.mutate()}
                            disabled={syncLists.isPending}
                            title={t("lists.syncFromTrakt")}
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--color-text-muted)",
                                padding: 4,
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            <RefreshCw
                                size={13}
                                style={
                                    syncLists.isPending
                                        ? { animation: "spin 1s linear infinite" }
                                        : {}
                                }
                            />
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            title={t("lists.createTitle")}
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--color-accent)",
                                padding: 4,
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            <Plus size={15} />
                        </button>
                    </div>
                </div>

                {/* List items */}
                {listsLoading ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "24px",
                            gap: "8px",
                            color: "var(--color-text-muted)",
                            fontSize: "12px",
                        }}
                    >
                        <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    </div>
                ) : (lists ?? []).length === 0 ? (
                    <div
                        style={{
                            padding: "24px 16px",
                            textAlign: "center",
                            color: "var(--color-text-muted)",
                            fontSize: "12px",
                        }}
                    >
                        <List size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                        <p style={{ margin: 0 }}>{t("lists.empty")}</p>
                    </div>
                ) : (
                    <ul
                        style={{
                            listStyle: "none",
                            margin: 0,
                            padding: "0 8px",
                            flex: 1,
                            overflowY: "auto",
                        }}
                    >
                        {(lists ?? []).map((list) => (
                            <li key={list.id}>
                                <button
                                    onClick={() =>
                                        setSelectedListId(
                                            list.id === selectedListId ? null : list.id,
                                        )
                                    }
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        background:
                                            list.id === selectedListId
                                                ? "var(--color-nav-active-bg)"
                                                : "transparent",
                                        border:
                                            list.id === selectedListId
                                                ? "1px solid var(--color-nav-active-border)"
                                                : "1px solid transparent",
                                        borderRadius: "8px",
                                        padding: "9px 10px",
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "3px",
                                        transition: "all 0.13s",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: "6px",
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: "13px",
                                                fontWeight: 600,
                                                color:
                                                    list.id === selectedListId
                                                        ? "var(--color-accent-light)"
                                                        : "var(--color-text)",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {list.name}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: "11px",
                                                color: "var(--color-text-muted)",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {list.itemCount}
                                        </span>
                                    </div>
                                    <PrivacyBadge privacy={list.privacy} />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </aside>

            {/* Main content */}
            <main style={{ flex: 1, padding: "24px 28px", minWidth: 0 }}>
                {!selectedList ? (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "50vh",
                            color: "var(--color-text-muted)",
                            gap: "12px",
                        }}
                    >
                        <List size={40} style={{ opacity: 0.2 }} />
                        <p style={{ margin: 0, fontSize: "13px" }}>{t("lists.selectList")}</p>
                    </div>
                ) : (
                    <>
                        {/* List header */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                marginBottom: "24px",
                                gap: "16px",
                            }}
                        >
                            <div>
                                <h1
                                    style={{
                                        margin: 0,
                                        fontSize: "20px",
                                        fontWeight: 700,
                                        color: "var(--color-text)",
                                    }}
                                >
                                    {selectedList.name}
                                </h1>
                                {selectedList.description && (
                                    <p
                                        style={{
                                            margin: "4px 0 0",
                                            fontSize: "13px",
                                            color: "var(--color-text-muted)",
                                        }}
                                    >
                                        {selectedList.description}
                                    </p>
                                )}
                                <div style={{ marginTop: "8px" }}>
                                    <PrivacyBadge privacy={selectedList.privacy} />
                                </div>
                            </div>
                            {deleteConfirmId === selectedList.id ? (
                                <div style={{ display: "flex", gap: "6px" }}>
                                    <button
                                        onClick={() => {
                                            deleteList.mutate(selectedList.id, {
                                                onSuccess: () => {
                                                    setSelectedListId(null);
                                                    setDeleteConfirmId(null);
                                                },
                                            });
                                        }}
                                        style={{
                                            padding: "6px 12px",
                                            borderRadius: "7px",
                                            border: "none",
                                            background: "#ef4444",
                                            color: "#fff",
                                            fontSize: "12px",
                                            fontWeight: 600,
                                            cursor: "pointer",
                                        }}
                                    >
                                        {t("lists.confirmDelete")}
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirmId(null)}
                                        style={{
                                            padding: "6px 12px",
                                            borderRadius: "7px",
                                            border: "1px solid var(--color-border-subtle)",
                                            background: "transparent",
                                            color: "var(--color-text-muted)",
                                            fontSize: "12px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {t("common.cancel")}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setDeleteConfirmId(selectedList.id)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        padding: "6px 12px",
                                        borderRadius: "7px",
                                        border: "1px solid var(--color-border-subtle)",
                                        background: "transparent",
                                        color: "var(--color-text-muted)",
                                        fontSize: "12px",
                                        cursor: "pointer",
                                    }}
                                >
                                    <Trash2 size={12} />
                                    {t("lists.deleteList")}
                                </button>
                            )}
                        </div>

                        {/* Items grid */}
                        {itemsLoading ? (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    minHeight: "160px",
                                    gap: "8px",
                                    color: "var(--color-text-muted)",
                                }}
                            >
                                <Loader2
                                    size={16}
                                    style={{ animation: "spin 1s linear infinite" }}
                                />
                            </div>
                        ) : (items ?? []).length === 0 ? (
                            <div
                                style={{
                                    textAlign: "center",
                                    padding: "48px 0",
                                    color: "var(--color-text-muted)",
                                    fontSize: "13px",
                                }}
                            >
                                {t("lists.emptyItems")}
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                                    gap: "14px",
                                }}
                            >
                                <AnimatePresence>
                                    {(items ?? []).map((item, i) => {
                                        const detailPath =
                                            item.mediaType === "show" && item.showId
                                                ? `/shows/${item.showId}`
                                                : item.mediaType === "movie" && item.movieId
                                                  ? `/movies/${item.movieId}`
                                                  : null;

                                        return (
                                            <motion.div
                                                key={item.id}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{
                                                    duration: 0.18,
                                                    delay: Math.min(i * 0.02, 0.3),
                                                }}
                                                style={{ position: "relative" }}
                                            >
                                                {/* Remove button */}
                                                <button
                                                    onClick={() =>
                                                        removeItem.mutate({
                                                            listId: selectedList.id,
                                                            itemId: item.id,
                                                        })
                                                    }
                                                    disabled={removeItem.isPending}
                                                    title={t("lists.removeItem")}
                                                    style={{
                                                        position: "absolute",
                                                        top: 5,
                                                        right: 5,
                                                        zIndex: 2,
                                                        width: 22,
                                                        height: 22,
                                                        borderRadius: "5px",
                                                        border: "none",
                                                        background: "rgba(0,0,0,0.65)",
                                                        color: "var(--color-text-muted)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        cursor: "pointer",
                                                        backdropFilter: "blur(4px)",
                                                        transition: "color 0.15s",
                                                    }}
                                                    onMouseEnter={(e) =>
                                                        (e.currentTarget.style.color = "#ef4444")
                                                    }
                                                    onMouseLeave={(e) =>
                                                        (e.currentTarget.style.color =
                                                            "var(--color-text-muted)")
                                                    }
                                                >
                                                    <X size={11} />
                                                </button>

                                                <div
                                                    style={{
                                                        borderRadius: "10px",
                                                        overflow: "hidden",
                                                        background: "var(--color-surface)",
                                                        border: "1px solid var(--color-border-subtle)",
                                                        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                                                        transition:
                                                            "transform 0.15s, box-shadow 0.15s",
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.transform =
                                                            "translateY(-2px)";
                                                        e.currentTarget.style.boxShadow =
                                                            "0 6px 20px rgba(0,0,0,0.18)";
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform = "";
                                                        e.currentTarget.style.boxShadow =
                                                            "0 2px 10px rgba(0,0,0,0.1)";
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            aspectRatio: "2/3",
                                                            overflow: "hidden",
                                                            background: "var(--color-surface-3)",
                                                        }}
                                                    >
                                                        {detailPath ? (
                                                            <Link
                                                                to={detailPath}
                                                                style={{
                                                                    display: "block",
                                                                    height: "100%",
                                                                }}
                                                            >
                                                                {item.posterPath ? (
                                                                    <img
                                                                        src={
                                                                            tmdbImage(
                                                                                item.posterPath,
                                                                                "w342",
                                                                            ) ?? undefined
                                                                        }
                                                                        alt={item.title}
                                                                        loading="lazy"
                                                                        style={{
                                                                            width: "100%",
                                                                            height: "100%",
                                                                            objectFit: "cover",
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div
                                                                        style={{
                                                                            width: "100%",
                                                                            height: "100%",
                                                                            display: "flex",
                                                                            alignItems: "center",
                                                                            justifyContent:
                                                                                "center",
                                                                            padding: 8,
                                                                        }}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                fontSize: "10px",
                                                                                color: "var(--color-text-muted)",
                                                                                textAlign: "center",
                                                                            }}
                                                                        >
                                                                            {item.title}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </Link>
                                                        ) : item.posterPath ? (
                                                            <img
                                                                src={
                                                                    tmdbImage(
                                                                        item.posterPath,
                                                                        "w342",
                                                                    ) ?? undefined
                                                                }
                                                                alt={item.title}
                                                                loading="lazy"
                                                                style={{
                                                                    width: "100%",
                                                                    height: "100%",
                                                                    objectFit: "cover",
                                                                }}
                                                            />
                                                        ) : (
                                                            <div
                                                                style={{
                                                                    width: "100%",
                                                                    height: "100%",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    padding: 8,
                                                                }}
                                                            >
                                                                <span
                                                                    style={{
                                                                        fontSize: "10px",
                                                                        color: "var(--color-text-muted)",
                                                                        textAlign: "center",
                                                                    }}
                                                                >
                                                                    {item.title}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ padding: "7px 9px 9px" }}>
                                                        {detailPath ? (
                                                            <Link
                                                                to={detailPath}
                                                                style={{ textDecoration: "none" }}
                                                            >
                                                                <p
                                                                    style={{
                                                                        margin: 0,
                                                                        fontSize: "11px",
                                                                        fontWeight: 600,
                                                                        color: "var(--color-text)",
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        whiteSpace: "nowrap",
                                                                    }}
                                                                >
                                                                    {item.title}
                                                                </p>
                                                            </Link>
                                                        ) : (
                                                            <p
                                                                style={{
                                                                    margin: 0,
                                                                    fontSize: "11px",
                                                                    fontWeight: 600,
                                                                    color: "var(--color-text)",
                                                                    overflow: "hidden",
                                                                    textOverflow: "ellipsis",
                                                                    whiteSpace: "nowrap",
                                                                }}
                                                            >
                                                                {item.title}
                                                            </p>
                                                        )}
                                                        {item.year && (
                                                            <p
                                                                style={{
                                                                    margin: "2px 0 0",
                                                                    fontSize: "10px",
                                                                    color: "var(--color-text-muted)",
                                                                }}
                                                            >
                                                                {item.year}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </>
                )}
            </main>

            <AnimatePresence>
                {showCreateModal && <CreateListModal onClose={() => setShowCreateModal(false)} />}
            </AnimatePresence>
        </div>
    );
}
