// Both search endpoints share the same failure surface: a body that does not
// parse or does not have the expected shape is reported the same way, so the
// palette never shows a raw JSON/TypeError message.

const UNEXPECTED_RESPONSE = 'Search returned an unexpected response'

export async function readSearchResponse(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error(UNEXPECTED_RESPONSE)
  }
}

/** Piped nests channel results in `items`; the startpage worker returns them directly. */
export function asSearchArray(value: unknown): any[] {
  if (!Array.isArray(value)) throw new Error(UNEXPECTED_RESPONSE)

  return value
}
