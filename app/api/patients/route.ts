import { NextResponse } from "next/server"
import { z } from "zod"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"

// Phone validation - accepts international format with country code
const PhoneSchema = z.string().regex(/^\+\d{10,15}$/, "Phone must be in international format (e.g., +256700123456)")
const UgNIN = z.string().regex(/^[A-Z0-9]{14}$/).optional().nullable()

const PatientSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  ageYears: z.number().int().min(0).max(130).optional().nullable(),
  gender: z.enum(["Male","Female","Other"]).default("Other"),
  phone: PhoneSchema,
  address: z.string().optional().nullable(),
  nin: UgNIN,
  district: z.string().optional().nullable(),
  subcounty: z.string().optional().nullable(),
  parish: z.string().optional().nullable(),
  village: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  // Emergency contact
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: PhoneSchema.optional().nullable(),
  nextOfKinName: z.string().optional().nullable(), // Legacy field
  nextOfKinFirstName: z.string().optional().nullable(),
  nextOfKinLastName: z.string().optional().nullable(),
  nextOfKinCountry: z.string().optional().nullable(),
  nextOfKinPhone: PhoneSchema.optional().nullable(),
  nextOfKinRelation: z.string().optional().nullable(),
  nextOfKinResidence: z.string().optional().nullable(),
  insuranceProvider: z.string().optional().nullable(),
  insuranceMemberNo: z.string().optional().nullable(),
})

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "patients", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const p = PatientSchema.superRefine((val, ctx) => {
    if (!val.dateOfBirth && (val.ageYears === undefined || val.ageYears === null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dateOfBirth'], message: 'Either dateOfBirth or ageYears is required' })
    }
  }).parse(body)

  // Duplicate detection: same phone OR same name with matching DOB/age
  try {
    const { rows: dup } = await query(
      `SELECT id FROM patients WHERE phone = $1
         OR (
           first_name ILIKE $2 AND last_name ILIKE $3 AND (
             ($4::date IS NOT NULL AND date_of_birth = $4) OR
             ($4::date IS NULL AND $5::int IS NOT NULL AND age_years = $5)
           )
         ) LIMIT 1`,
      [p.phone, p.firstName, p.lastName, p.dateOfBirth || null, p.ageYears ?? null]
    )
    if (dup.length) {
      return NextResponse.json({ error: "Possible duplicate patient detected (matching phone or name + DOB/Age)." }, { status: 409 })
    }
  } catch {}

  // Insert only into columns that exist in this database (supports older schemas)
  const colsRes = await query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'patients'`
  )
  const present = new Set((colsRes.rows || []).map((r) => r.column_name))
  // Map of optional fields -> values
  const fieldMap: Array<[string, any]> = [
    ['first_name', p.firstName],
    ['last_name', p.lastName],
    ['date_of_birth', p.dateOfBirth || null],
    ['age_years', p.ageYears ?? null],
    ['gender', p.gender],
    ['phone', p.phone],
    ['address', p.address || null],
    ['nin', p.nin || null],
    ['district', p.district || null],
    ['subcounty', p.subcounty || null],
    ['parish', p.parish || null],
    ['village', p.village || null],
    ['occupation', p.occupation || null],
    ['emergency_contact_name', p.emergencyContactName || null],
    ['emergency_contact_phone', p.emergencyContactPhone || null],
    ['blood_group', p.bloodGroup || null],
    ['allergies', p.allergies || null],
    ['next_of_kin_name', p.nextOfKinName || null],
    ['next_of_kin_first_name', p.nextOfKinFirstName || null],
    ['next_of_kin_last_name', p.nextOfKinLastName || null],
    ['next_of_kin_country', p.nextOfKinCountry || null],
    ['next_of_kin_phone', p.nextOfKinPhone || null],
    ['next_of_kin_relation', p.nextOfKinRelation || null],
    ['next_of_kin_residence', p.nextOfKinResidence || null],
    ['insurance_provider', p.insuranceProvider || null],
    ['insurance_member_no', p.insuranceMemberNo || null],
  ]
  const insertCols: string[] = []
  const values: any[] = []
  const placeholders: string[] = []
  // Always include patient_number if present
  if (present.has('patient_number')) insertCols.push('patient_number')
  for (const [col, val] of fieldMap) {
    if (present.has(col)) {
      insertCols.push(col)
      values.push(val)
      placeholders.push(`$${values.length}`)
    }
  }
  const pnExpr = `concat('P', lpad(nextval('patient_number_seq')::text, 4, '0'))`
  const colsSql = insertCols.join(', ')
  const valsSql = (present.has('patient_number') ? `${pnExpr}${placeholders.length ? ', ' : ''}` : '') + placeholders.join(', ')
  if (!colsSql) return NextResponse.json({ error: 'Patients table has no expected columns' }, { status: 500 })
  const { rows } = await query<{ id: string }>(
    `INSERT INTO patients (${colsSql}) VALUES (${valsSql}) RETURNING id`,
    values,
  )
  const newId = rows[0].id
  await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,[auth.userId, 'patient_created', 'patient', newId, JSON.stringify(p)])
  // Broadcast notifications to key roles
  try {
    const title = 'New Patient Registered'
    const message = `${p.firstName} ${p.lastName} has been registered.`
    const payload = JSON.stringify({ patientId: newId })
    // Nurse + Hospital Admin (and optionally Doctor)
    await query(`INSERT INTO notifications (role, title, message, payload) VALUES ('Nurse',$1,$2,$3)`, [title, message, payload])
    await query(`INSERT INTO notifications (role, title, message, payload) VALUES ('Hospital Admin',$1,$2,$3)`, [title, message, payload])
  } catch {}
  return NextResponse.json({ id: newId })
}

 

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth || !can(auth.role, "patients", "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const url = new URL(req.url)
    const q = (url.searchParams.get("q") || "").trim()
    const byId = (url.searchParams.get("id") || "").trim()
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 500)))
    const after = url.searchParams.get("after") // ISO timestamp cursor for created_at (exclusive)
    const compact = url.searchParams.get("compact") === "1"

    // Fast path: compact search mode for lookups
    if (compact) {
      const where: string[] = []
      const params: any[] = []
      let idx = 1
      if (q) {
        where.push(`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR patient_number ILIKE $${idx} OR phone ILIKE $${idx})`)
        params.push(`%${q}%`)
        idx++
      }
      if (after) {
        where.push(`created_at < $${idx}`)
        params.push(after)
        idx++
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""
      const { rows } = await query(
        `SELECT id, patient_number, first_name, last_name, created_at FROM patients ${whereSql} ORDER BY created_at DESC LIMIT $${idx}`,
        [...params, limit]
      )
      const nextCursor = rows.length === limit ? rows[rows.length - 1].created_at : undefined
      return NextResponse.json({ patients: rows, nextCursor })
    }

    // Full detail query (default)
    const params: any[] = []
    let idx = 1
    const whereParts: string[] = []
    if (byId) {
      whereParts.push(`p.id = $${idx}`)
      params.push(byId)
      idx++
    }
    if (q) {
      whereParts.push(`(p.first_name ILIKE $${idx} OR p.last_name ILIKE $${idx} OR p.patient_number ILIKE $${idx} OR p.phone ILIKE $${idx})`)
      params.push(`%${q}%`)
      idx++
    }
    if (after) {
      whereParts.push(`p.created_at < $${idx}`)
      params.push(after)
      idx++
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : ""
    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT 
        p.id, 
        p.patient_number, 
        p.first_name, 
        p.last_name, 
        p.date_of_birth,
        p.age_years,
        p.gender, 
        p.phone, 
        p.email, 
        p.address, 
        p.emergency_contact_name,
        p.emergency_contact_phone,
        p.blood_group,
        p.allergies,
        p.current_status,
        p.nin,
        p.district, 
        p.subcounty, 
        p.parish, 
        p.village, 
        p.occupation, 
        p.next_of_kin_name, 
        p.next_of_kin_first_name,
        p.next_of_kin_last_name,
        p.next_of_kin_country,
        p.next_of_kin_phone,
        COALESCE(p.next_of_kin_relation, '') as next_of_kin_relation,
        COALESCE(p.next_of_kin_residence, '') as next_of_kin_residence,
        p.insurance_provider, 
        p.insurance_member_no, 
        p.created_at,
        t.category as latest_triage_category,
        t.chief_complaint as latest_triage_complaint,
        t.temperature as latest_temperature,
        t.heart_rate as latest_heart_rate,
        t.blood_pressure_systolic as latest_systolic,
        t.blood_pressure_diastolic as latest_diastolic,
        t.respiratory_rate as latest_respiratory_rate,
        t.oxygen_saturation as latest_spo2,
        t.avpu as latest_avpu,
        t.mode as latest_triage_mode,
        t.mobility as latest_triage_mobility,
        t.metadata as latest_triage_metadata,
        t.recorded_at as latest_triage_date
      FROM patients p
      LEFT JOIN LATERAL (
        SELECT category, chief_complaint, temperature, heart_rate, blood_pressure_systolic, 
               blood_pressure_diastolic, respiratory_rate, oxygen_saturation, avpu, 
               mode, mobility, metadata,
               COALESCE(recorded_at, created_at) as recorded_at
        FROM triage_assessments
        WHERE patient_id = p.id
        ORDER BY COALESCE(recorded_at, created_at) DESC
        LIMIT 1
      ) t ON true
      ${whereSql}
      ORDER BY p.created_at DESC 
      LIMIT ${compact || byId ? 1 : limit}`,
      params
    )
    
    // Parse metadata JSONB and add parsed fields to each patient row
    const patientsWithParsedMetadata = rows.map((patient: any) => {
      if (patient.latest_triage_metadata) {
        try {
          const metadata = typeof patient.latest_triage_metadata === 'string' 
            ? JSON.parse(patient.latest_triage_metadata) 
            : patient.latest_triage_metadata
          return {
            ...patient,
            latest_triage_metadata: metadata,
            latest_pain_level: metadata?.painLevel || null,
            latest_is_pregnant: metadata?.isPregnant || null,
            latest_pregnancy_weeks: metadata?.pregnancyWeeks || null,
            latest_is_postpartum: metadata?.isPostpartum || null,
            latest_postpartum_days: metadata?.postpartumDays || null,
            latest_has_trauma: metadata?.hasTrauma || null,
            latest_trauma_type: metadata?.traumaType || null,
            latest_trauma_mechanism: metadata?.traumaMechanism || null,
            latest_burns_percentage: metadata?.burnsPercentage || null,
            latest_weight: metadata?.weight || null,
            latest_has_respiratory_distress: metadata?.hasRespiratoryDistress || null,
            latest_has_chest_pain: metadata?.hasChestPain || null,
            latest_has_severe_bleeding: metadata?.hasSevereBleeding || null,
          }
        } catch {
          return patient
        }
      }
      return patient
    })
    
    const nextCursor = byId ? undefined : (rows.length === limit ? rows[rows.length - 1].created_at : undefined)
    return NextResponse.json({ patients: patientsWithParsedMetadata, nextCursor })
  } catch (err: any) {
    console.error("Error fetching patients:", err)
    return NextResponse.json({ 
      error: "Failed to fetch patients",
      details: err.message 
    }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "patients", "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const patientId = url.searchParams.get("id")
    if (!patientId) return NextResponse.json({ error: "Patient ID is required" }, { status: 400 })

    // Get patient info before deletion for audit log
    const { rows: patientRows } = await query(
      `SELECT id, patient_number, first_name, last_name FROM patients WHERE id = $1`,
      [patientId]
    )
    
    if (patientRows.length === 0) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    const patient = patientRows[0]

    // Delete patient
    await query(`DELETE FROM patients WHERE id = $1`, [patientId])

    // Log deletion in audit trail
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        auth.userId,
        "DELETE",
        "Patient",
        patientId,
        JSON.stringify({
          category: "PATIENT",
          description: `Patient ${patient.first_name} ${patient.last_name} (${patient.patient_number}) deleted`,
          metadata: { patientNumber: patient.patient_number }
        })
      ]
    )

    return NextResponse.json({ success: true, message: "Patient deleted successfully" })
  } catch (err: any) {
    console.error("Error deleting patient:", err)
    return NextResponse.json({ error: "Failed to delete patient" }, { status: 500 })
  }
}


// Update patient (partial)
export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "patients", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    const id: string | undefined = body?.id
    if (!id) return NextResponse.json({ error: "Patient id is required" }, { status: 400 })

    // Only patch keys that are actually present on the incoming payload.
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)

    // Validate and normalize NIN if provided
    let normalizedNin: string | null | undefined = undefined
    if (has('nin')) {
      if (body.nin === null || body.nin === undefined || body.nin === '') {
        normalizedNin = null
      } else {
        const ninValue = String(body.nin).trim().toUpperCase()
        if (!/^[A-Z0-9]{14}$/.test(ninValue)) {
          return NextResponse.json({ error: "NIN must be 14 letters/digits" }, { status: 400 })
        }
        normalizedNin = ninValue
      }
    }

    // Compute combined NOK name only when either first/last are provided
    const hasNokFirst = has('nextOfKinFirstName')
    const hasNokLast = has('nextOfKinLastName')
    const nokCombined = (hasNokFirst || hasNokLast)
      ? [body.nextOfKinFirstName || '', body.nextOfKinLastName || ''].join(' ').trim() || null
      : undefined

    // Map allowed payload keys to DB columns (values are undefined if not provided on payload)
    const patchMap: Array<[string, any]> = [
      ['first_name', has('firstName') ? body.firstName : undefined],
      ['last_name', has('lastName') ? body.lastName : undefined],
      ['age_years', has('ageYears') ? (typeof body.ageYears === 'number' ? body.ageYears : (body.ageYears ?? null)) : undefined],
      ['gender', has('gender') ? body.gender : undefined],
      ['phone', has('phone') ? body.phone : undefined],
      ['address', has('address') ? (body.address ?? null) : undefined],
      ['nin', normalizedNin],
      ['district', has('district') ? (body.district ?? null) : undefined],
      ['subcounty', has('subcounty') ? (body.subcounty ?? null) : undefined],
      ['parish', has('parish') ? (body.parish ?? null) : undefined],
      ['village', has('village') ? (body.village ?? null) : undefined],
      ['occupation', has('occupation') ? (body.occupation ?? null) : undefined],
      ['emergency_contact_name', has('emergencyContactName') ? (body.emergencyContactName ?? null) : undefined],
      ['emergency_contact_phone', has('emergencyContactPhone') ? (body.emergencyContactPhone ?? null) : undefined],
      ['blood_group', has('bloodGroup') ? (body.bloodGroup ?? null) : undefined],
      ['allergies', has('allergies') ? (body.allergies ?? null) : undefined],
      // Keep legacy combined NOK name in sync when fields are provided
      ['next_of_kin_name', nokCombined],
      ['next_of_kin_first_name', has('nextOfKinFirstName') ? (body.nextOfKinFirstName ?? null) : undefined],
      ['next_of_kin_last_name', has('nextOfKinLastName') ? (body.nextOfKinLastName ?? null) : undefined],
      ['next_of_kin_phone', has('nextOfKinPhone') ? (body.nextOfKinPhone ?? null) : undefined],
      ['next_of_kin_relation', has('nextOfKinRelation') ? (body.nextOfKinRelation ?? null) : undefined],
      ['next_of_kin_residence', has('nextOfKinResidence') ? (body.nextOfKinResidence ?? null) : undefined],
      ['insurance_provider', has('insuranceProvider') ? (body.insuranceProvider ?? null) : undefined],
      ['insurance_member_no', has('insuranceMemberNo') ? (body.insuranceMemberNo ?? null) : undefined],
    ]

    // Filter out undefined and build SET list for columns that exist
    const colsRes = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'patients'`
    )
    const present = new Set((colsRes.rows || []).map((r) => r.column_name))
    const sets: string[] = []
    const values: any[] = []
    let idx = 1
    for (const [col, val] of patchMap) {
      if (!present.has(col)) continue
      if (typeof val === 'undefined') continue
      sets.push(`${col} = $${idx}`)
      values.push(val)
      idx++
    }
    if (!sets.length) {
      return NextResponse.json({ success: true })
    }

    // Conditionally include updated_at if column exists
    const includeUpdatedAt = present.has('updated_at')
    const setSql = includeUpdatedAt ? `${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP` : sets.join(', ')

    values.push(id)
    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE patients SET ${setSql} WHERE id = $${idx}`,
      values,
    )

    // Return the updated row for immediate UI hydration
    const { rows: updatedRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT 
        id, patient_number, first_name, last_name, date_of_birth, age_years, gender, phone, email, address,
        blood_group, current_status, nin, district, subcounty, parish, village, occupation, next_of_kin_name,
        next_of_kin_first_name, next_of_kin_last_name, next_of_kin_country, next_of_kin_phone,
        COALESCE(next_of_kin_relation, '') as next_of_kin_relation,
        COALESCE(next_of_kin_residence, '') as next_of_kin_residence,
        insurance_provider, insurance_member_no, emergency_contact_name, emergency_contact_phone, created_at
      FROM patients WHERE id = $1`,
      [id]
    )
    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'patient_updated', 'patient', id, JSON.stringify(body)],
    )
    return NextResponse.json({ success: true, patient: updatedRows?.[0] || null })
  } catch (err: any) {
    console.error("Error updating patient:", err)
    return NextResponse.json({ error: "Failed to update patient" }, { status: 500 })
  }
}


