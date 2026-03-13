"use client"

export function buildSearchParamsString(
  current: { toString(): string },
  updates: Record<string, string | null | undefined>,
) {
  const params = new URLSearchParams(current.toString())

  for (const [key, value] of Object.entries(updates)) {
    if (!value) params.delete(key)
    else params.set(key, value)
  }

  return params.toString()
}
