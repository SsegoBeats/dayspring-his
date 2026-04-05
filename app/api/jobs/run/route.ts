import { NextResponse } from "next/server"
import { type NextRequest } from "next/server"
import { query, withClient } from "@/lib/db"
import { emailTemplates, sendEmail } from "@/lib/email-service"

export async function POST(req: NextRequest) {
  const expectedToken = process.env.JOBS_RUNNER_TOKEN
  if (!expectedToken) {
    console.error("[jobs/run] JOBS_RUNNER_TOKEN environment variable is not set")
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 })
  }
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // Worker loop (single tick): claim a pending job and execute
  try {
    const job = await withClient(async (client) => {
      await client.query("BEGIN")
      const res = await client.query(
        `SELECT id, queue, payload FROM jobs WHERE status = 'pending' AND run_at <= NOW() ORDER BY run_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
      )
      const row = res.rows[0]
      if (!row) {
        await client.query("COMMIT")
        return null
      }
      await client.query(`UPDATE jobs SET status = 'processing' WHERE id = $1`, [row.id])
      await client.query("COMMIT")
      return row
    })
    if (!job) return NextResponse.json({ processed: 0 })

    try {
      if (job.queue === "appointment-reminder") {
        const payload = job.payload as any
        const template = emailTemplates.appointmentConfirmation(
          payload.patientName,
          payload.doctorName || "",
          payload.date,
          payload.time,
          payload.department,
        )
        await sendEmail(payload.email, template)
      }
      await query(`UPDATE jobs SET status = 'completed' WHERE id = $1`, [job.id])
      return NextResponse.json({ processed: 1 })
    } catch (err: any) {
      await query(
        `UPDATE jobs SET status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END, attempts = attempts + 1, last_error = $2, run_at = NOW() + INTERVAL '5 minutes' WHERE id = $1`,
        [job.id, String(err?.message || err)],
      )
      return NextResponse.json({ processed: 0, error: "job failed" }, { status: 500 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: "Runner error" }, { status: 500 })
  }
}


