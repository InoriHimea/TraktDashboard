// Shared language fallback logic (P2-T12).
//
// Extracted from apps/api so the API sync pipeline and the web client can resolve TMDB
// content languages the same way. Order of resolution: user locale → zh variants → en-US
// → the show's original language family.

// All known TMDB language tags per language family, in preference order.
export const LANGUAGE_FAMILY_VARIANTS: Record<string, string[]> = {
    zh: ["zh-TW", "zh-SG", "zh-HK", "zh-CN", "zh"],
    en: ["en-US", "en-GB", "en"],
    ja: ["ja-JP", "ja"],
    ko: ["ko-KR", "ko"],
    fr: ["fr-FR", "fr-BE", "fr-CA", "fr"],
    de: ["de-DE", "de-AT", "de-CH", "de"],
    es: ["es-ES", "es-MX", "es-419", "es"],
    pt: ["pt-BR", "pt-PT", "pt"],
    it: ["it-IT", "it"],
    ru: ["ru-RU", "ru"],
    ar: ["ar-SA", "ar"],
    th: ["th-TH", "th"],
    vi: ["vi-VN", "vi"],
    id: ["id-ID", "id"],
    tr: ["tr-TR", "tr"],
    pl: ["pl-PL", "pl"],
    nl: ["nl-NL", "nl-BE", "nl"],
    sv: ["sv-SE", "sv"],
    da: ["da-DK", "da"],
    fi: ["fi-FI", "fi"],
    nb: ["nb-NO", "nb"],
    cs: ["cs-CZ", "cs"],
    hu: ["hu-HU", "hu"],
    ro: ["ro-RO", "ro"],
    uk: ["uk-UA", "uk"],
    he: ["he-IL", "he"],
};

/**
 * Extract the base language code from a locale string.
 * "zh-TW" → "zh", "en-US" → "en", "ja" → "ja".
 */
export function getLanguageFamily(locale: string): string {
    return locale.split("-")[0].toLowerCase();
}

/**
 * Build the TMDB language query list for a given user locale + show original language.
 * Returns a deduplicated list in priority order.
 */
export function buildLanguageFallbackChain(
    userLocale: string | null,
    originalLanguage: string | null,
): string[] {
    const chain: string[] = [];

    if (userLocale) chain.push(userLocale);
    chain.push("zh-TW", "zh-SG", "zh-HK", "zh-CN", "en-US");

    if (originalLanguage) {
        const origFamily = getLanguageFamily(originalLanguage);
        const variants = LANGUAGE_FAMILY_VARIANTS[origFamily] ?? [
            `${origFamily}-${origFamily.toUpperCase()}`,
            origFamily,
        ];
        chain.push(...variants);
    }

    return [...new Set(chain)];
}
