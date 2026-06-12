// Conventional Commits enforcement (P3-T03). Validates commit message format only —
// no side effects (unlike the removed after-commit release hook).
export default {
    extends: ["@commitlint/config-conventional"],
};
