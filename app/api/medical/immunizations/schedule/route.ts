import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"
import { ensureMedicalTables } from "@/lib/medical-tables"
import { DAYS_PER_BUCKET, TIMING_BUCKETS, VACCINES_BY_TIMING } from "@/lib/immunization-schedule"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null

    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await ensureMedicalTables()

    const { rows } = await queryWithSession<{
      timing_bucket: string
      day_offset: number | null
      vaccine_name: string | null
    }>(
      { role: auth.role, userId: auth.userId },
      `SELECT timing_bucket, day_offset, vaccine_name
       FROM immunization_schedule_config
       WHERE is_active = TRUE
       ORDER BY bucket_order ASC, vaccine_order ASC, timing_bucket ASC`,
      [],
    )

    if (!rows.length) {
      return NextResponse.json({
        buckets: [...TIMING_BUCKETS],
        dayOffsets: Object.fromEntries(Object.entries(DAYS_PER_BUCKET).map(([k, v]) => [k, v])),
        vaccinesByTiming: Object.fromEntries(Object.entries(VACCINES_BY_TIMING).map(([k, v]) => [k, [...v]])),
      })
    }

    const buckets: string[] = []
    const dayOffsets: Record<string, number | null> = {}
    const vaccinesByTiming: Record<string, string[]> = {}

    for (const row of rows) {
      if (!buckets.includes(row.timing_bucket)) buckets.push(row.timing_bucket)
      if (!dayOffsets.hasOwnProperty(row.timing_bucket)) dayOffsets[row.timing_bucket] = row.day_offset
      if (!vaccinesByTiming[row.timing_bucket]) vaccinesByTiming[row.timing_bucket] = []
      if (row.vaccine_name) vaccinesByTiming[row.timing_bucket].push(row.vaccine_name)
    }

    return NextResponse.json({ buckets, dayOffsets, vaccinesByTiming })
  } catch (err) {
    console.error("GET /api/medical/immunizations/schedule error:", err)
    return NextResponse.json({ error: "Failed to load immunization schedule" }, { status: 500 })
  }
}
