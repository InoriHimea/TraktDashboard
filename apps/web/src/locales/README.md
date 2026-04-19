# Internationalization (i18n)

This directory contains translation files for the application UI.

## Structure

```
locales/
├── en-US.json    # English translations
├── zh-CN.json    # Simplified Chinese translations
└── README.md     # This file
```

## Usage

### Import the translation function

```typescript
import { t, setLocale, getLocale } from '../lib/i18n';
```

### Use translations in components

```typescript
// Simple translation
<button>{t("common.save")}</button>

// Translation with parameters
<p>{t("watchHistory.recordCount", { count: 5 })}</p>
```

### Change locale

```typescript
// Set locale (usually done in SettingsPage after user changes language)
setLocale("en-US");

// Get current locale
const currentLocale = getLocale();
```

## Translation Keys

Translation keys use dot notation to organize related strings:

- `common.*` - Common UI elements (buttons, labels, etc.)
- `nav.*` - Navigation items
- `watchHistory.*` - Watch history panel
- `settings.*` - Settings page
- `progress.*` - Progress page filters

## Adding New Translations

1. Add the key-value pair to both `en-US.json` and `zh-CN.json`
2. Use the `t()` function in your component
3. For dynamic values, use `{{paramName}}` in the translation string

Example:

```json
// en-US.json
{
  "myFeature": {
    "greeting": "Hello, {{name}}!"
  }
}

// zh-CN.json
{
  "myFeature": {
    "greeting": "你好，{{name}}！"
  }
}
```

```typescript
// Component
t("myFeature.greeting", { name: "Alice" })
// Output: "Hello, Alice!" or "你好，Alice！"
```

## Supported Languages

- `en-US` - English (United States)
- `zh-CN` - Simplified Chinese (China)
- `zh-TW` - Traditional Chinese (Taiwan) - Falls back to zh-CN

To add a new language:

1. Create a new JSON file (e.g., `ja-JP.json`)
2. Copy the structure from `en-US.json`
3. Translate all values
4. Import and register it in `lib/i18n.ts`

## Notes

- The locale is automatically set based on the user's `displayLanguage` setting
- When the user saves settings, the UI locale updates immediately
- Content translations (show titles, episode names) are handled separately via TMDB API during sync
