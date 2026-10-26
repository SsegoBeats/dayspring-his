import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"
import {
  FamilyPlanningCreateSchema,
  isMethodRequired,
  validateRemovalPayload,
  resolveEventStatus,
} from "@/lib/family-planning-validation"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const patientId = url.searchParams.get("patientId")?.trim() || null
    const eventType = url.searchParams.get("eventType")?.trim() || null
    const method = url.searchParams.get("method")?.trim() || null
    const status = url.searchParams.get("status")?.trim() || null
    const fromParam = url.searchParams.get("from")?.trim() || null
    const toParam = url.searchParams.get("to")?.trim() || null

    if (patientId && !UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
    }

    const where: string[] = []
    const values: unknown[] = []

    if (patientId) {
      values.push(patientId)
      where.push(`fpe.patient_id = $${values.length}`)
    }
    if (eventType) {
      values.push(eventType)
      where.push(`fpe.event_type = $${values.length}`)
    }
    if (method) {
      values.push(method)
      where.push(`fpe.method = $${values.length}`)
    }
    if (status) {
      values.push(status)
      where.push(`fpe.status = $${values.length}`)
    }
    if (fromParam && toParam) {
      const from = new Date(fromParam)
      const to = new Date(toParam)
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return NextResponse.json({ error: "from/to must be valid date-time values" }, { status: 400 })
      }
      values.push(from.toISOString())
      values.push(to.toISOString())
      where.push(`fpe.encounter_date >= $${values.length - 1}::timestamp AND fpe.encounter_date <= $${values.length}::timestamp`)
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT
         fpe.id,
         fpe.patient_id,
         fpe.recorded_by,
         fpe.encounter_date,
         fpe.event_type,
         fpe.method,
         fpe.status,
         fpe.reason,
         fpe.removal_reason,
         fpe.replacement_method,
         fpe.next_review_date,
         fpe.is_postpartum,
         fpe.postpartum_weeks,
         fpe.notes,
         fpe.supersedes_event_id,
         fpe.metadata,
         fpe.created_at,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
         p.patient_number,
         u.name AS recorded_by_name
       FROM family_planning_events fpe
       JOIN patients p ON p.id = fpe.patient_id
       LEFT JOIN users u ON u.id = fpe.recorded_by
       ${whereClause}
       ORDER BY fpe.encounter_date DESC, fpe.created_at DESC
       LIMIT 300`,
      values,
    )

    return NextResponse.json({ events: rows })
  } catch (err) {
    console.error("GET /api/family-planning error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = FamilyPlanningCreateSchema.parse(await req.json())

    if (isMethodRequired(parsed.eventType) && !parsed.method) {
      return NextResponse.json({ error: "method is required for this event type" }, { status: 400 })
    }
    const removalValidationError = validateRemovalPayload(parsed.eventType, parsed.removalReason)
    if (removalValidationError) {
      return NextResponse.json({ error: removalValidationError }, { status: 400 })
    }

    const encounterDate = parsed.encounterDate ?? new Date().toISOString()
    const resolvedStatus = resolveEventStatus(parsed.eventType, parsed.status)

    const { rows } = await queryWithSession<{ id: string }>(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO family_planning_events (
         patient_id,
         recorded_by,
         encounter_date,
         event_type,
         method,
         status,
         reason,
         removal_reason,
         replacement_method,
         next_review_date,
         is_postpartum,
         postpartum_weeks,
         notes,
         supersedes_event_id,
         metadata
       )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
       RETURNING id`,
      [
        parsed.patientId,
        auth.userId,
        encounterDate,
        parsed.eventType,
        parsed.method ?? null,
        resolvedStatus,
        parsed.reason ?? null,
        parsed.removalReason ?? null,
        parsed.replacementMethod ?? null,
        parsed.nextReviewDate ?? null,
        parsed.isPostpartum,
        parsed.postpartumWeeks ?? null,
        parsed.notes ?? null,
        parsed.supersedesEventId ?? null,
        parsed.metadata ? JSON.stringify(parsed.metadata) : null,
      ],
    )

    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        auth.userId,
        "FAMILY_PLANNING_EVENT_CREATED",
        "FamilyPlanningEvent",
        rows[0].id,
        JSON.stringify({
          patientId: parsed.patientId,
          eventType: parsed.eventType,
          method: parsed.method ?? null,
          status: resolvedStatus,
          removalReason: parsed.removalReason ?? null,
          replacementMethod: parsed.replacementMethod ?? null,
          supersedesEventId: parsed.supersedesEventId ?? null,
        }),
      ],
    )

    return NextResponse.json({ id: rows[0].id }, { status: 201 })
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 })
    }
    console.error("POST /api/family-planning error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
