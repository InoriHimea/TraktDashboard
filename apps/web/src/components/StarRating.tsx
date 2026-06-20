import { useState } from "react";
import { useRatings, useSetRating, useRemoveRating } from "../hooks";
import { t } from "../lib/i18n";

interface StarRatingProps {
    type: "show" | "movie";
    localId: number;
}

const STAR_COUNT = 5;

function StarIcon({ fill, size = 20 }: { fill: "empty" | "half" | "full"; size?: number }) {
    const id = `half-${Math.random().toString(36).slice(2, 7)}`;
    if (fill === "full") {
        return (
            <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
                <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    fill="var(--color-rating-star, #f59e0b)"
                    stroke="var(--color-rating-star, #f59e0b)"
                    strokeWidth="0"
                />
            </svg>
        );
    }
    if (fill === "half") {
        return (
            <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
                <defs>
                    <linearGradient id={id}>
                        <stop offset="50%" stopColor="var(--color-rating-star, #f59e0b)" />
                        <stop offset="50%" stopColor="transparent" />
                    </linearGradient>
                </defs>
                <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    fill={`url(#${id})`}
                    stroke="var(--color-rating-star, #f59e0b)"
                    strokeWidth="1.5"
                />
            </svg>
        );
    }
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill="transparent"
                stroke="var(--color-text-muted)"
                strokeWidth="1.5"
            />
        </svg>
    );
}

export function StarRating({ type, localId }: StarRatingProps) {
    const { data: allRatings } = useRatings();
    const setRating = useSetRating();
    const removeRating = useRemoveRating();
    const [hoverScore, setHoverScore] = useState<number | null>(null);

    const myRating = allRatings?.find(
        (r) =>
            r.mediaType === type &&
            (type === "show" ? r.showId === localId : r.movieId === localId),
    );
    const currentScore = myRating?.rating ?? null; // 1-10

    const displayScore = hoverScore ?? currentScore;

    async function handleClick(score: number) {
        if (setRating.isPending || removeRating.isPending) return;
        if (currentScore === score) {
            await removeRating.mutateAsync({ type, localId });
        } else {
            await setRating.mutateAsync({ type, localId, rating: score });
        }
    }

    return (
        <div
            style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            onMouseLeave={() => setHoverScore(null)}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                }}
            >
                {Array.from({ length: STAR_COUNT }, (_, starIdx) => {
                    const fullScore = (starIdx + 1) * 2; // 2,4,6,8,10
                    const halfScore = fullScore - 1; // 1,3,5,7,9

                    let leftFill: "empty" | "half" | "full" = "empty";
                    let rightFill: "empty" | "half" | "full" = "empty";

                    if (displayScore !== null) {
                        if (displayScore >= fullScore) {
                            leftFill = "full";
                            rightFill = "full";
                        } else if (displayScore >= halfScore) {
                            leftFill = "full";
                            rightFill = "empty";
                        }
                    }

                    return (
                        <div
                            key={starIdx}
                            style={{
                                position: "relative",
                                width: 22,
                                height: 22,
                                cursor: "pointer",
                                flexShrink: 0,
                            }}
                        >
                            {/* Left half — odd score */}
                            <div
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    width: "50%",
                                    height: "100%",
                                    zIndex: 1,
                                }}
                                onMouseEnter={() => setHoverScore(halfScore)}
                                onClick={() => handleClick(halfScore)}
                            />
                            {/* Right half — even score */}
                            <div
                                style={{
                                    position: "absolute",
                                    right: 0,
                                    top: 0,
                                    width: "50%",
                                    height: "100%",
                                    zIndex: 1,
                                }}
                                onMouseEnter={() => setHoverScore(fullScore)}
                                onClick={() => handleClick(fullScore)}
                            />

                            {/* Star visual — composite of left + right fill */}
                            {leftFill === "full" && rightFill === "full" ? (
                                <StarIcon fill="full" size={22} />
                            ) : leftFill === "full" ? (
                                <StarIcon fill="half" size={22} />
                            ) : (
                                <StarIcon fill="empty" size={22} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Score label */}
            <p
                style={{
                    fontSize: "11px",
                    color:
                        displayScore !== null
                            ? "var(--color-rating-star, #f59e0b)"
                            : "var(--color-text-muted)",
                    margin: 0,
                    minHeight: "16px",
                }}
            >
                {displayScore !== null
                    ? t("rating.scoreLabel", { score: displayScore })
                    : currentScore !== null
                      ? ""
                      : t("rating.prompt")}
            </p>
        </div>
    );
}
