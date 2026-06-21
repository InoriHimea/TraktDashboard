import { useEffect, useRef, useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { useNote, useUpsertNote, useDeleteNote } from "../hooks";
import { t } from "../lib/i18n";

interface NoteEditorProps {
    mediaType: "episode" | "show" | "movie";
    showId?: number;
    movieId?: number;
    season?: number;
    episode?: number;
}

const MAX_CHARS = 10000;
const DEBOUNCE_MS = 1200;

export function NoteEditor({ mediaType, showId, movieId, season, episode }: NoteEditorProps) {
    const { data: note, isLoading } = useNote({ mediaType, showId, movieId, season, episode });
    const upsert = useUpsertNote();
    const deleteNote = useDeleteNote();

    const [content, setContent] = useState("");
    const [saved, setSaved] = useState(true);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initialized = useRef(false);

    // When the target changes (different episode/show/movie), allow content to
    // repopulate from the newly-loaded note instead of keeping the previous one.
    useEffect(() => {
        initialized.current = false;
    }, [mediaType, showId, movieId, season, episode]);

    // Populate local state once the current note loads; the guard prevents a
    // background refetch from clobbering in-progress edits of the same note.
    useEffect(() => {
        if (!initialized.current && note !== undefined) {
            setContent(note?.content ?? "");
            initialized.current = true;
        }
    }, [note]);

    // Clear any pending debounce on unmount so the timer can't fire a mutation/
    // setState after the editor is gone (and so the timer isn't leaked).
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    function handleChange(val: string) {
        if (val.length > MAX_CHARS) return;
        setContent(val);
        setSaved(false);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            upsert.mutate(
                { mediaType, showId, movieId, season, episode, content: val },
                { onSuccess: () => setSaved(true) },
            );
        }, DEBOUNCE_MS);
    }

    function handleDelete() {
        if (!note) return;
        deleteNote.mutate(note.id, {
            onSuccess: () => {
                setContent("");
                setSaved(true);
                initialized.current = false;
            },
        });
    }

    const charCount = content.length;
    const isPending = upsert.isPending || deleteNote.isPending;

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "16px 20px",
                borderRadius: "14px",
                border: "1px solid var(--color-border-subtle)",
                background: "var(--color-surface)",
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                }}
            >
                <p
                    style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        margin: 0,
                    }}
                >
                    {t("notes.title")}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {isPending && (
                        <Loader2
                            size={12}
                            style={{
                                animation: "spin 1s linear infinite",
                                color: "var(--color-text-muted)",
                            }}
                        />
                    )}
                    {saved && !isPending && content.length > 0 && (
                        <Save size={12} style={{ color: "var(--color-text-muted)" }} />
                    )}
                    {note && (
                        <button
                            onClick={handleDelete}
                            disabled={isPending}
                            title={t("notes.delete")}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 22,
                                height: 22,
                                borderRadius: "5px",
                                border: "none",
                                background: "transparent",
                                color: "var(--color-text-muted)",
                                cursor: isPending ? "default" : "pointer",
                                opacity: isPending ? 0.5 : 1,
                                transition: "color 0.15s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.color = "var(--color-text-muted)")
                            }
                        >
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Textarea */}
            {isLoading ? (
                <div
                    style={{
                        height: "80px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Loader2
                        size={14}
                        style={{
                            animation: "spin 1s linear infinite",
                            color: "var(--color-text-muted)",
                        }}
                    />
                </div>
            ) : (
                <textarea
                    value={content}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder={t("notes.placeholder")}
                    rows={4}
                    style={{
                        width: "100%",
                        boxSizing: "border-box",
                        resize: "vertical",
                        minHeight: "80px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--color-border-subtle)",
                        background: "var(--color-bg)",
                        color: "var(--color-text-base)",
                        fontSize: "13px",
                        lineHeight: 1.6,
                        fontFamily: "inherit",
                        outline: "none",
                        transition: "border-color 0.15s",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-accent)")}
                    onBlur={(e) =>
                        (e.currentTarget.style.borderColor = "var(--color-border-subtle)")
                    }
                />
            )}

            {/* Footer */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    color: "var(--color-text-muted)",
                }}
            >
                <span>
                    {!saved && !isPending
                        ? t("notes.unsaved")
                        : saved && content
                          ? t("notes.saved")
                          : ""}
                </span>
                <span style={{ opacity: charCount > MAX_CHARS * 0.9 ? 1 : 0.5 }}>
                    {charCount} / {MAX_CHARS}
                </span>
            </div>
        </div>
    );
}
