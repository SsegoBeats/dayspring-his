import { withClient } from "@/lib/db"

export async function rateLimitPg(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = new Date()
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000)
  return withClient(async (client) => {
    await client.query("BEGIN")
    const res = await client.query(
      `INSERT INTO rate_limits (key, window_seconds, window_start, count)
       VALUES ($1,$2,$3,1)
       ON CONFLICT (key, window_seconds, window_start)
       DO UPDATE SET count = rate_limits.count + 1
       RETURNING count`,
      [key, windowSeconds, windowStart.toISOString()],
    )
    await client.query("COMMIT")
    const count = Number(res.rows[0].count)
    return count <= limit
  })
}


