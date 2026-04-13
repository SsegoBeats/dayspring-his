type Bucket = { tokens: number; last: number }

const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key) || { tokens: limit, last: now }
  const elapsed = now - bucket.last
  const refill = Math.floor(elapsed / windowMs) * limit
  const tokens = Math.min(limit, bucket.tokens + refill)
  const allowed = tokens > 0
  buckets.set(key, { tokens: allowed ? tokens - 1 : tokens, last: allowed ? now : bucket.last })
  return allowed
}


