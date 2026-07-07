export interface TabItem<T extends string> {
    id: T;
    label: string;
}

interface TabsProps<T extends string> {
    tabs: TabItem<T>[];
    active: T;
    onChange: (id: T) => void;
}

// Segmented-control pill switcher, extracted from the media-type tabs on DiscoverPage.
// The pill row scrolls horizontally instead of overflowing when the viewport is
// narrower than the tab set (N6 batch 4 mobile audit).
export function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
    return (
        <div
            style={{
                display: "flex",
                gap: "4px",
                background: "var(--color-surface-2)",
                borderRadius: "10px",
                padding: "4px",
                width: "fit-content",
                maxWidth: "100%",
                overflowX: "auto",
            }}
        >
            {tabs.map(({ id, label }) => (
                <button
                    key={id}
                    type="button"
                    onClick={() => onChange(id)}
                    style={{
                        padding: "6px 16px",
                        borderRadius: "7px",
                        border: "none",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        background: active === id ? "var(--color-surface)" : "transparent",
                        color: active === id ? "var(--color-text)" : "var(--color-text-muted)",
                        boxShadow: active === id ? "0 1px 4px rgba(0,0,0,0.18)" : "none",
                        transition: "all 0.15s",
                    }}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
