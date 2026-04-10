export type Theme = 'dark' | 'light'

export function applyTheme(theme: Theme): void {
  if (theme === 'light') {
    document.documentElement.dataset.theme = 'light'
  } else {
    delete document.documentElement.dataset.theme
  }
}

export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem('theme', theme)
  } catch (e) {}
}

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme')
    return stored === 'light' ? 'light' : 'dark'
  } catch (e) {
    return 'dark'
  }
}
