// Prettier config (P1-T08). Values chosen to match the dominant existing style
// (4-space indent, double quotes, trailing commas) and minimize reformat churn.
/** @type {import("prettier").Config} */
export default {
    useTabs: false,
    tabWidth: 4,
    printWidth: 100,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    arrowParens: "always",
    endOfLine: "lf",
};
