import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession, withSession } from "@/lib/db"
import { ensureMedicalTables } from "@/lib/medical-tables"
import {
  deriveStatus,
  computeDueDateFromDob,
  computeDueDateFromDobWithOffset,
  computeOverdueDate,
  isImmunizationStatus,
  TIMING_BUCKETS,
  type ImmunizationStatus,
} from "@/lib/immunization-schedule"
import { alignStatusWithDueDate, validateOtherVaccineReason, validateStatusRules } from "@/lib/immunization-validation"
import { matchesFacilityScope, canUpdateImmunizationRecord } from "@/lib/immunization-access"

type ScheduleConfig = {
  dayOffsets: Record<string, number | null>
  vaccinesByTiming: Record<string, string[]>
}

async function getImmunizationScheduleConfig(auth: { role: string; userId: string }): Promise<ScheduleConfig> {
  try {
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

    if (!rows.length) throw new Error("No schedule rows")

    const dayOffsets: Record<string, number | null> = {}
    const vaccinesByTiming: Record<string, string[]> = {}
    for (const row of rows) {
      if (!dayOffsets.hasOwnProperty(row.timing_bucket)) {
        dayOffsets[row.timing_bucket] = row.day_offset
      }
      if (!vaccinesByTiming[row.timing_bucket]) {
        vaccinesByTiming[row.timing_bucket] = []
      }
      if (row.vaccine_name) {
        vaccinesByTiming[row.timing_bucket].push(row.vaccine_name)
      }
    }

    return { dayOffsets, vaccinesByTiming }
  } catch {
    // Fallback keeps API functional when config table is unavailable.
    const { DAYS_PER_BUCKET, VACCINES_BY_TIMING } = await import("@/lib/immunization-schedule")
    const dayOffsets = Object.fromEntries(Object.entries(DAYS_PER_BUCKET).map(([k, v]) => [k, v]))
    const vaccinesByTiming = Object.fromEntries(
      Object.entries(VACCINES_BY_TIMING).map(([k, v]) => [k, [...v]]),
    )
    return { dayOffsets, vaccinesByTiming }
  }
}

function isIsoDate(value: string | null | undefined): boolean {
  if (!value) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getReasonForStatus(status: ImmunizationStatus, body: {
  statusReason?: string | null
  contraindicationReason?: string | null
  refusalReason?: string | null
}): string | null {
  if (status === "Contraindicated") return (body.contraindicationReason || body.statusReason || "").trim() || null
  if (status === "Refused") return (body.refusalReason || body.statusReason || "").trim() || null
  if (status === "Not Given") return (body.statusReason || "").trim() || null
  return (body.statusReason || "").trim() || null
}

async function getAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  return auth
}

function parseAdministeredAt(input: string | null | undefined): string | null {
  if (!input) return null
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

async function canAccessPatient(auth: { role: string; userId: string }, patientId: string) {
  if (!patientId) return false
  if (auth.role === "Hospital Admin") return true

  const { rows: userRows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT facility_id FROM users WHERE id = $1 LIMIT 1`,
    [auth.userId],
  )
  const userFacility = userRows[0]?.facility_id
  if (!userFacility) return true

  const { rows: patientRows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT facility_id FROM patients WHERE id = $1 LIMIT 1`,
    [patientId],
  )
  if (!patientRows.length) return false

  return matchesFacilityScope(userFacility, patientRows[0].facility_id)
}

export async function GET(req: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    await ensureMedicalTables()

    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get("patientId")

    if (patientId && !(await canAccessPatient(auth, patientId))) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    const whereClause = patientId ? "WHERE pi.patient_id = $1" : ""
    const params = patientId ? [patientId] : []

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT pi.id, pi.patient_id, pi.vaccine_name, pi.date_administered,
        pi.administered_at, pi.administration_site,
              pi.next_due_date, pi.overdue_date, pi.age_time, pi.schedule_code, pi.dose, pi.status, pi.status_reason,
              pi.administered_by, pi.route, pi.manufacturer, pi.batch_number,
              pi.is_other_vaccine, pi.other_vaccine_reason, pi.contraindication_reason, pi.refusal_reason,
              pi.notes, pi.created_at
       FROM patient_immunizations pi
       ${whereClause}
       ORDER BY pi.date_administered DESC`,
      params,
    )

    return NextResponse.json({ immunizations: rows })
  } catch (err: any) {
    if (err?.code === "42P01") return NextResponse.json({ immunizations: [] })
    console.error("Error fetching immunizations:", err)
    return NextResponse.json({ error: "Failed to fetch immunizations" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    await ensureMedicalTables()

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: string
      vaccineName?: string
      dateAdministered?: string | null
      administeredAt?: string | null
      nextDueDate?: string | null
      overdueDate?: string | null
      ageTime?: string
      scheduleCode?: string
      dose?: string
      status?: ImmunizationStatus
      statusReason?: string
      administeredBy?: string
      route?: string
      administrationSite?: string
      manufacturer?: string
      batchNumber?: string
      isOtherVaccine?: boolean
      otherVaccineReason?: string
      contraindicationReason?: string
      refusalReason?: string
      notes?: string
    }

    const patientId = (body.patientId || "").trim()
    const vaccineName = (body.vaccineName || "").trim()
    const dateAdministered = typeof body.dateAdministered === "string" ? body.dateAdministered.trim() : ""
    const administeredAt = parseAdministeredAt(body.administeredAt)

    if (!patientId || !vaccineName) {
      return NextResponse.json({ error: "patientId and vaccineName are required" }, { status: 400 })
    }

    if (!(await canAccessPatient(auth, patientId))) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    if (dateAdministered && !isIsoDate(dateAdministered)) {
      return NextResponse.json({ error: "dateAdministered must be in YYYY-MM-DD format" }, { status: 400 })
    }
    if (body.administeredAt && !administeredAt) {
      return NextResponse.json({ error: "administeredAt must be a valid date-time" }, { status: 400 })
    }
    if (body.nextDueDate && !isIsoDate(body.nextDueDate)) {
      return NextResponse.json({ error: "nextDueDate must be in YYYY-MM-DD format" }, { status: 400 })
    }
    if (body.overdueDate && !isIsoDate(body.overdueDate)) {
      return NextResponse.json({ error: "overdueDate must be in YYYY-MM-DD format" }, { status: 400 })
    }

    const { rows: patientRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT date_of_birth FROM patients WHERE id = $1 LIMIT 1`,
      [patientId],
    )
    if (!patientRows.length) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    const normalizedAgeTime = (body.ageTime || "").trim() || null
    const scheduleConfig = await getImmunizationScheduleConfig(auth)
    const configuredBuckets = Object.keys(scheduleConfig.dayOffsets)
    if (normalizedAgeTime && !configuredBuckets.includes(normalizedAgeTime)) {
      return NextResponse.json({ error: "Invalid ageTime value" }, { status: 400 })
    }
    const configuredOffset = normalizedAgeTime ? scheduleConfig.dayOffsets[normalizedAgeTime] : null
    const computedDueDate = body.nextDueDate || computeDueDateFromDobWithOffset(patientRows[0].date_of_birth, configuredOffset)
    const computedOverdueDate = body.overdueDate || computeOverdueDate(computedDueDate, 0)

    const rawStatus = deriveStatus(body.status, dateAdministered || undefined, computedDueDate || undefined)
    const status = alignStatusWithDueDate(rawStatus, computedDueDate)
    const statusReason = getReasonForStatus(status, body)
    const contraindicationReason = (body.contraindicationReason || "").trim() || null
    const refusalReason = (body.refusalReason || "").trim() || null
    const otherVaccineReason = (body.otherVaccineReason || "").trim() || null

    const statusValidationError = validateStatusRules(
      status,
      {
        dateAdministered: dateAdministered || undefined,
        nextDueDate: computedDueDate,
        overdueDate: computedOverdueDate,
      },
      statusReason,
    )
    if (statusValidationError) {
      return NextResponse.json({ error: statusValidationError }, { status: 400 })
    }
    const otherVaccineReasonValidationError = validateOtherVaccineReason(body.isOtherVaccine, otherVaccineReason)
    if (otherVaccineReasonValidationError) {
      return NextResponse.json({ error: otherVaccineReasonValidationError }, { status: 400 })
    }

    if (normalizedAgeTime) {
      const configuredVaccines = scheduleConfig.vaccinesByTiming[normalizedAgeTime] || []
      const isConfiguredOther = configuredVaccines.length > 0
        && !configuredVaccines.some((v) => v.toLowerCase() === vaccineName.toLowerCase())
      if (isConfiguredOther && !otherVaccineReason) {
        return NextResponse.json({ error: "Reason / indication is required for non-standard vaccine at selected age stage" }, { status: 400 })
      }
    }

    const creation = await withSession(
      { role: auth.role, userId: auth.userId },
      async (client) => {
        await client.query(
          `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
          [`${patientId}:${vaccineName.toLowerCase()}`],
        )

        if (normalizedAgeTime) {
          const { rows: sameStageRows } = await client.query(
            `SELECT id
             FROM patient_immunizations
             WHERE patient_id = $1
               AND age_time = $2
               AND LOWER(vaccine_name) = LOWER($3)
               AND status = 'Given'
             LIMIT 1`,
            [patientId, normalizedAgeTime, vaccineName],
          )
          if (sameStageRows.length) {
            return { error: "This vaccine has already been recorded for the selected age stage", status: 409 }
          }
        }

        const { rows: duplicateRows } = await client.query(
          `SELECT id
           FROM patient_immunizations
           WHERE patient_id = $1
             AND LOWER(vaccine_name) = LOWER($2)
             AND COALESCE(date_administered::text, '') = COALESCE($3, '')
             AND COALESCE(dose, '') = COALESCE($4, '')
           LIMIT 1`,
          [patientId, vaccineName, dateAdministered || null, body.dose || null],
        )
        if (duplicateRows.length) {
          return { error: "Duplicate dose record already exists for this patient", status: 409 }
        }

        const { rows } = await client.query(
          `INSERT INTO patient_immunizations (
             patient_id, vaccine_name, date_administered, administered_at, administration_site, next_due_date, overdue_date,
             age_time, schedule_code, dose, status, status_reason, administered_by, route, manufacturer,
             batch_number, is_other_vaccine, other_vaccine_reason, contraindication_reason, refusal_reason, notes, recorded_by
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
           RETURNING id, patient_id, vaccine_name, date_administered, administered_at, administration_site, next_due_date, overdue_date,
             age_time, schedule_code, dose, status, status_reason, administered_by, route, manufacturer,
             batch_number, is_other_vaccine, other_vaccine_reason, contraindication_reason, refusal_reason, notes, created_at`,
          [
            patientId,
            vaccineName,
            dateAdministered || null,
            administeredAt,
            body.administrationSite || null,
            computedDueDate || null,
            computedOverdueDate || null,
            normalizedAgeTime,
            body.scheduleCode || normalizedAgeTime || null,
            body.dose || null,
            status,
            statusReason,
            body.administeredBy || null,
            body.route || null,
            body.manufacturer || null,
            body.batchNumber || null,
            Boolean(body.isOtherVaccine),
            otherVaccineReason,
            contraindicationReason,
            refusalReason,
            body.notes || null,
            auth.userId,
          ],
        )

        return { immunization: rows[0] }
      },
    )

    if ("error" in creation) {
      return NextResponse.json({ error: creation.error }, { status: creation.status })
    }

    return NextResponse.json({ immunization: creation.immunization })
  } catch (err) {
    console.error("Error creating immunization:", err)
    return NextResponse.json({ error: "Failed to create immunization" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    await ensureMedicalTables()

    const { searchParams } = new URL(req.url)
    const id = (searchParams.get("id") || "").trim()
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      vaccineName?: string
      dateAdministered?: string | null
      administeredAt?: string | null
      nextDueDate?: string | null
      overdueDate?: string | null
      ageTime?: string | null
      scheduleCode?: string | null
      dose?: string | null
      status?: ImmunizationStatus
      statusReason?: string | null
      administeredBy?: string | null
      route?: string | null
      administrationSite?: string | null
      manufacturer?: string | null
      batchNumber?: string | null
      isOtherVaccine?: boolean
      otherVaccineReason?: string | null
      contraindicationReason?: string | null
      refusalReason?: string | null
      notes?: string | null
    }

    if (typeof body.status !== "undefined" && !isImmunizationStatus(body.status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 })
    }
    if (typeof body.dateAdministered === "string" && body.dateAdministered && !isIsoDate(body.dateAdministered)) {
      return NextResponse.json({ error: "dateAdministered must be in YYYY-MM-DD format" }, { status: 400 })
    }
    if (body.administeredAt && !parseAdministeredAt(body.administeredAt)) {
      return NextResponse.json({ error: "administeredAt must be a valid date-time" }, { status: 400 })
    }
    if (typeof body.nextDueDate === "string" && body.nextDueDate && !isIsoDate(body.nextDueDate)) {
      return NextResponse.json({ error: "nextDueDate must be in YYYY-MM-DD format" }, { status: 400 })
    }
    if (typeof body.overdueDate === "string" && body.overdueDate && !isIsoDate(body.overdueDate)) {
      return NextResponse.json({ error: "overdueDate must be in YYYY-MM-DD format" }, { status: 400 })
    }

    const { rows: currentRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT pi.patient_id, pi.recorded_by, pi.vaccine_name, pi.date_administered, pi.dose,
              pi.administered_at,
              p.date_of_birth, p.facility_id AS patient_facility_id
       FROM patient_immunizations pi
       JOIN patients p ON p.id = pi.patient_id
       WHERE pi.id = $1
       LIMIT 1`,
      [id],
    )
    if (!currentRows.length) {
      return NextResponse.json({ error: "Immunization not found" }, { status: 404 })
    }

    const current = currentRows[0]
    if (auth.role !== "Hospital Admin") {
      const { rows: userRows } = await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `SELECT facility_id FROM users WHERE id = $1 LIMIT 1`,
        [auth.userId],
      )
      const userFacility = userRows[0]?.facility_id
      const facilityAllowed = canUpdateImmunizationRecord(
        { id: auth.userId, role: auth.role },
        current.recorded_by,
        userFacility,
        current.patient_facility_id,
      )

      if (!facilityAllowed) {
        const isFacilityMismatch = userFacility && current.patient_facility_id
          && String(current.patient_facility_id) !== String(userFacility)
        if (isFacilityMismatch) {
          return NextResponse.json({ error: "Immunization not found" }, { status: 404 })
        }
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }
    const nextVaccineName = typeof body.vaccineName === "string" ? body.vaccineName.trim() : current.vaccine_name
    const nextDateAdministered =
      typeof body.dateAdministered === "string" && body.dateAdministered
        ? body.dateAdministered
        : current.date_administered ? String(current.date_administered).slice(0, 10) : undefined
    const nextAdministeredAt = typeof body.administeredAt !== "undefined"
      ? parseAdministeredAt(body.administeredAt)
      : current.administered_at || null
    const nextDose = typeof body.dose !== "undefined" ? (body.dose || null) : current.dose
    const nextAgeTime = typeof body.ageTime !== "undefined" ? body.ageTime : null
    const scheduleConfig = await getImmunizationScheduleConfig(auth)
    const nextDueDate =
      typeof body.nextDueDate !== "undefined"
        ? body.nextDueDate
        : computeDueDateFromDobWithOffset(current.date_of_birth, nextAgeTime ? scheduleConfig.dayOffsets[nextAgeTime] : null)
    const nextOverdueDate =
      typeof body.overdueDate !== "undefined"
        ? body.overdueDate
        : computeOverdueDate(nextDueDate, 0)
    const rawNextStatus =
      typeof body.status === "string"
        ? deriveStatus(body.status, nextDateAdministered, nextDueDate || undefined)
        : undefined
    const nextStatus = rawNextStatus
      ? alignStatusWithDueDate(rawNextStatus, nextDueDate)
      : undefined
    const nextStatusReason =
      typeof body.status !== "undefined"
        ? getReasonForStatus(nextStatus as ImmunizationStatus, body)
        : typeof body.statusReason !== "undefined"
          ? body.statusReason || null
          : null
    const nextOtherVaccineReason =
      typeof body.otherVaccineReason !== "undefined" ? body.otherVaccineReason || null : null

    if (nextStatus) {
      const statusValidationError = validateStatusRules(
        nextStatus,
        {
          dateAdministered: nextDateAdministered,
          nextDueDate,
          overdueDate: nextOverdueDate,
        },
        nextStatusReason,
      )
      if (statusValidationError) {
        return NextResponse.json({ error: statusValidationError }, { status: 400 })
      }
    }
    const otherVaccineReasonValidationError = validateOtherVaccineReason(body.isOtherVaccine, nextOtherVaccineReason)
    if (otherVaccineReasonValidationError) {
      return NextResponse.json({ error: otherVaccineReasonValidationError }, { status: 400 })
    }

    const { rows: duplicateRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT id
       FROM patient_immunizations
       WHERE patient_id = $1
         AND LOWER(vaccine_name) = LOWER($2)
         AND COALESCE(date_administered::text, '') = COALESCE($3, '')
         AND COALESCE(dose, '') = COALESCE($4, '')
         AND id <> $5
       LIMIT 1`,
      [current.patient_id, nextVaccineName, nextDateAdministered || null, nextDose, id],
    )
    if (duplicateRows.length) {
      return NextResponse.json({ error: "Duplicate dose record already exists for this patient" }, { status: 409 })
    }

    const assignments: string[] = []
    const values: unknown[] = []
    const setField = (column: string, value: unknown) => {
      values.push(value)
      assignments.push(`${column} = $${values.length}`)
    }

    if (typeof body.vaccineName === "string") setField("vaccine_name", nextVaccineName)
    if (typeof body.dateAdministered === "string") setField("date_administered", body.dateAdministered)
    if (typeof body.administeredAt !== "undefined") setField("administered_at", nextAdministeredAt)
    if (typeof body.nextDueDate !== "undefined") setField("next_due_date", nextDueDate || null)
    if (typeof body.overdueDate !== "undefined") setField("overdue_date", nextOverdueDate || null)
    if (typeof body.ageTime !== "undefined") setField("age_time", body.ageTime || null)
    if (typeof body.scheduleCode !== "undefined") setField("schedule_code", body.scheduleCode || null)
    if (typeof body.dose !== "undefined") setField("dose", body.dose || null)
    if (typeof body.status === "string") setField("status", nextStatus)
    if (typeof body.statusReason !== "undefined" || typeof body.status !== "undefined") {
      setField("status_reason", nextStatusReason)
    }
    if (typeof body.administeredBy !== "undefined") setField("administered_by", body.administeredBy || null)
    if (typeof body.route !== "undefined") setField("route", body.route || null)
    if (typeof body.administrationSite !== "undefined") setField("administration_site", body.administrationSite || null)
    if (typeof body.manufacturer !== "undefined") setField("manufacturer", body.manufacturer || null)
    if (typeof body.batchNumber !== "undefined") setField("batch_number", body.batchNumber || null)
    if (typeof body.isOtherVaccine === "boolean") setField("is_other_vaccine", body.isOtherVaccine)
    if (typeof body.otherVaccineReason !== "undefined") setField("other_vaccine_reason", nextOtherVaccineReason)
    if (typeof body.contraindicationReason !== "undefined") setField("contraindication_reason", body.contraindicationReason || null)
    if (typeof body.refusalReason !== "undefined") setField("refusal_reason", body.refusalReason || null)
    if (typeof body.notes !== "undefined") setField("notes", body.notes || null)

    if (!assignments.length) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    values.push(id)

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE patient_immunizations
        SET ${assignments.join(", ")}
        WHERE id = $${values.length}
        RETURNING id, patient_id, vaccine_name, date_administered, administered_at, administration_site, next_due_date, overdue_date,
          age_time, schedule_code, dose, status, status_reason, administered_by, route, manufacturer,
          batch_number, is_other_vaccine, other_vaccine_reason, contraindication_reason, refusal_reason, notes, created_at`,
      values,
    )

    if (!rows.length) {
      return NextResponse.json({ error: "Immunization not found" }, { status: 404 })
    }

    return NextResponse.json({ immunization: rows[0] })
  } catch (err) {
    console.error("Error updating immunization:", err)
    return NextResponse.json({ error: "Failed to update immunization" }, { status: 500 })
  }
}
