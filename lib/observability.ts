import { randomUUID } from "crypto"

export function generateRequestId() {
  return randomUUID()
}

export function nowMs() {
  return Date.now()
}

export function logSlowQuery(sql: string, ms: number, threshold = 100) {
  if (ms >= threshold) {
    console.warn(`[slow-query] ${ms}ms :: ${sql.slice(0, 120)}...`)
  }
}


