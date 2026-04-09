import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

function parseEnvFile(content: string): Record<string, string> {
  const parsed: Record<string, string> = {}

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex <= 0) continue

    const key = trimmed.slice(0, eqIndex).trim()
    const rawValue = trimmed.slice(eqIndex + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')
    if (!key) continue

    parsed[key] = value
  }

  return parsed
}

function loadEnvIfNeeded() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '../../../.env'),
  ]

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue

    const parsed = parseEnvFile(readFileSync(filePath, 'utf8'))
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = value
      }
    }
    return
  }
}

loadEnvIfNeeded()

