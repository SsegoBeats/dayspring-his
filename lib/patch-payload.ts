export function buildPatchPayload<T extends Record<string, unknown>>(payload: T): Partial<T> {
  const normalized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue

    if (typeof value === "string") {
      const trimmed = value.trim()
      normalized[key] = trimmed.length > 0 ? trimmed : null
      continue
    }

    if (typeof value === "number" && !Number.isFinite(value)) {
      normalized[key] = null
      continue
    }

    normalized[key] = value
  }

  return normalized as Partial<T>
}
