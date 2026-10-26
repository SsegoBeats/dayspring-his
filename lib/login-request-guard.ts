export function createLoginRequestGuard() {
  const inFlight = new Set<string>()

  return {
    begin(key: string): boolean {
      const normalizedKey = String(key ?? "").trim()
      if (!normalizedKey) return false
      if (inFlight.has(normalizedKey)) return false
      inFlight.add(normalizedKey)
      return true
    },
    finish(key: string): void {
      const normalizedKey = String(key ?? "").trim()
      if (!normalizedKey) return
      inFlight.delete(normalizedKey)
    },
    clear(): void {
      inFlight.clear()
    },
  }
}

export function buildLoginRequestKey(email: string, role?: string): string {
  return `${String(email || "").trim().toLowerCase()}|${String(role || "").trim().toLowerCase()}`
}

export function isDatabaseConfiguredForLogin(): boolean {
  return Boolean(process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim())
}

export const loginRequestGuard = createLoginRequestGuard()
