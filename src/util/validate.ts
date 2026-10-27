// Shared shape checks for untrusted data (localStorage and imported backups).
// Every helper is total: it never throws, it degrades to the provided fallback.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Finite, non-negative number, otherwise the fallback. */
export function countOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : fallback
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Walks the `[key, value]` list every store serializes as. The per-entry parser
 * returns the value to keep, or `undefined` to skip the entry (having reported
 * why in strict mode). A malformed pair never aborts the rest of the list, so
 * hydration keeps everything it can parse.
 */
export function readPairs<T>(
  raw: unknown,
  label: string,
  issues: string[] | undefined,
  parse: (key: string, value: unknown, path: string) => T | undefined
): T[] {
  if (raw === undefined) return []

  if (!Array.isArray(raw)) {
    issues?.push(`${label}: expected an array`)
    return []
  }

  const entries: T[] = []

  raw.forEach((pair, index) => {
    const path = `${label}[${index}]`

    if (!Array.isArray(pair) || pair.length !== 2) {
      issues?.push(`${path}: expected a [key, value] pair`)
      return
    }

    const [key, value] = pair
    if (typeof key !== 'string') {
      issues?.push(`${path}: expected a string key`)
      return
    }

    const entry = parse(key, value, path)
    if (entry !== undefined) entries.push(entry)
  })

  return entries
}

