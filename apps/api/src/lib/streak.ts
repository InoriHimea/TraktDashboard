/**
 * Longest run of consecutive calendar days within a set of watch dates.
 *
 * Input: ISO date strings (`YYYY-MM-DD`), in any order and possibly with
 * duplicates — the function dedupes and sorts internally, so it does not rely
 * on the caller pre-sorting (unlike the previous inline implementation, which
 * depended on the SQL `ORDER BY DATE(...)`).
 *
 * Returns 0 for empty input. Dates are compared at UTC midnight, so day-to-day
 * diffs are exactly 86_400_000 ms regardless of DST.
 */
export function longestConsecutiveDays(days: string[]): number {
    const unique = [...new Set(days)].sort();
    let longest = 0;
    let current = 0;
    let prev: string | null = null;

    for (const day of unique) {
        if (prev) {
            const diff = Math.round(
                (new Date(day).getTime() - new Date(prev).getTime()) / 86_400_000,
            );
            current = diff === 1 ? current + 1 : 1;
        } else {
            current = 1;
        }
        longest = Math.max(longest, current);
        prev = day;
    }

    return longest;
}
