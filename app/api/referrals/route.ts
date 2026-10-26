import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/security"
import { z } from "zod"

const CreateReferralSchema = z.object({
  patientId: z.string().uuid(),
  type: z.enum(['internal', 'external-out', 'external-in']),
  receivingUserId: z.string().uuid().optional(),
  receivingDepartment: z.string().optional(),
  clinicalRecordId: z.string().uuid().optional(),
  externalFacilityName: z.string().optional(),
  externalClinicianName: z.string().optional(),
  externalClinicianContact: z.string().optional(),
  facilityId: z.string().uuid().optional(),
  reason: z.string().min(1),
  urgency: z.enum(['emergency', 'Very Urgent', 'urgent', 'routine', 'low']).default('routine'),
  notes: z.string().optional(),
})

function canAccessReferrals(role: string) {
  return ['Clinician', 'Nurse', 'Midwife', 'Hospital Admin'].includes(role)
}

async function ensureReferralSchema() {
  await query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS handoff_snapshot JSONB`)
  await query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ`)
  await query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES users(id) ON DELETE SET NULL`)
  await query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`)
  await query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL`)
  await query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb`)
}

async function buildHandoffSnapshot(patientId: string, clinicalRecordId?: string) {
  try {
    const [patientRes, latestRecordRes, latestVitalsRes, prescriptionsRes, labsRes, proceduresRes] = await Promise.all([
      query<{ first_name: string; last_name: string; patient_number?: string | null }>(
        `SELECT first_name, last_name, patient_number FROM patients WHERE id = $1`,
        [patientId],
      ),
      query<{
        id: string
        visit_date: string
        chief_complaint?: string | null
        history?: string | null
        impression?: string | null
        diagnosis?: string | null
        treatment_plan?: string | null
        notes?: string | null
      }>(
        `SELECT id, visit_date, chief_complaint, history, impression, diagnosis, treatment_plan, notes
           FROM medical_records
          WHERE patient_id = $1
            AND ($2::uuid IS NULL OR id = $2)
          ORDER BY visit_date DESC, created_at DESC
          LIMIT 1`,
        [patientId, clinicalRecordId || null],
      ),
      query<{
        recorded_at?: string
        blood_pressure_systolic?: number | null
        blood_pressure_diastolic?: number | null
        heart_rate?: number | null
        temperature?: number | null
        respiratory_rate?: number | null
        oxygen_saturation?: number | null
        notes?: string | null
      }>(
        `SELECT recorded_at, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature,
                respiratory_rate, oxygen_saturation, notes
           FROM vital_signs
          WHERE patient_id = $1
          ORDER BY recorded_at DESC NULLS LAST
          LIMIT 1`,
        [patientId],
      ),
      query<{
        id: string
        medication_name: string
        dosage?: string | null
        frequency?: string | null
        duration?: string | null
        instructions?: string | null
        status?: string | null
        created_at?: string
      }>(
        `SELECT id, medication_name, dosage, frequency, duration, instructions, status, created_at
           FROM prescriptions
          WHERE patient_id = $1
          ORDER BY created_at DESC
          LIMIT 10`,
        [patientId],
      ),
      query<{
        id: string
        test_name?: string | null
        priority?: string | null
        status?: string | null
        ordered_at?: string
        completed_at?: string | null
        results?: string | null
      }>(
        `SELECT id, test_name, priority, status, ordered_at, completed_at, results
           FROM lab_tests
          WHERE patient_id = $1
          ORDER BY ordered_at DESC
          LIMIT 10`,
        [patientId],
      ),
      query<{
        id: string
        procedure_name: string
        procedure_type?: string | null
        status?: string | null
        performed_by_name?: string | null
        reason_indication?: string | null
        findings?: string | null
        procedure_notes?: string | null
        outcome?: string | null
        follow_up_instructions?: string | null
        performed_at?: string | null
      }>(
        `SELECT id, procedure_name, procedure_type, status, performed_by_name, reason_indication,
                findings, procedure_notes, outcome, follow_up_instructions, performed_at
           FROM procedures
          WHERE patient_id = $1
          ORDER BY ordered_at DESC
          LIMIT 10`,
        [patientId],
      ),
    ])

    const patient = patientRes.rows[0]
    const latestClinicalRecord = latestRecordRes.rows[0] || null
    const followUpRequirements = [
      latestClinicalRecord?.treatment_plan,
      latestClinicalRecord?.notes,
      ...proceduresRes.rows.map((procedure) => procedure.follow_up_instructions).filter(Boolean),
    ].filter(Boolean).join("\n") || null

    return {
      capturedAt: new Date().toISOString(),
      patient: patient
        ? {
            id: patientId,
            patientNumber: patient.patient_number || null,
            name: `${patient.first_name} ${patient.last_name}`.trim(),
          }
        : { id: patientId },
      latestClinicalRecord: latestClinicalRecord,
      latestVitals: latestVitalsRes.rows[0] || null,
      recentPrescriptions: prescriptionsRes.rows,
      recentLabResults: labsRes.rows,
      requestedProcedures: proceduresRes.rows.map((procedure) => ({
        id: procedure.id,
        name: procedure.procedure_name,
        type: procedure.procedure_type || null,
        status: procedure.status || null,
        performer: procedure.performed_by_name || null,
        reason: procedure.reason_indication || null,
        findings: procedure.findings || null,
        notes: procedure.procedure_notes || null,
        outcome: procedure.outcome || null,
        followUpInstructions: procedure.follow_up_instructions || null,
        performedAt: procedure.performed_at || null,
      })),
      requestedMedications: prescriptionsRes.rows,
      followUpRequirements,
      instructions: latestClinicalRecord?.treatment_plan || latestClinicalRecord?.notes || null,
    }
  } catch (error) {
    console.error("[referrals] Failed to build handoff snapshot:", error)
    throw error
  }
}

export async function POST(req: Request) {
  try {
    await ensureReferralSchema()
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!canAccessReferrals(payload.role)) {
      return NextResponse.json({ 
        error: "Only Clinicians, Midwives, Nurses, and Admins can create referrals"
      }, { status: 403 })
    }

    const body = await req.json()
    const data = CreateReferralSchema.parse(body)

    // Validate internal referral target: either a specific receiving user or a destination department.
    if (data.type === 'internal' && !data.receivingUserId && !data.receivingDepartment) {
      return NextResponse.json({ 
        error: "Internal referrals require a receiving clinician or destination department"
      }, { status: 400 })
    }

    // Validate external referral has facility info
    if (data.type.startsWith('external') && !data.externalFacilityName) {
      return NextResponse.json({ 
        error: "External referrals require facility name" 
      }, { status: 400 })
    }

    // Get referring user info (including facility for scoping)
    const userResult = await query<{ name: string; role: string; facility_id?: string }>(
      `SELECT name, role, facility_id FROM users WHERE id = $1`,
      [payload.sub]
    )

    const referringUser = userResult.rows[0]
    const creatorFacilityId = referringUser?.facility_id || null

    // Ensure patient exists and enforce facility membership for internal referrals
    const patientFacRes = await query<{ facility_id?: string }>(`SELECT facility_id FROM patients WHERE id = $1`, [data.patientId])
    if ((patientFacRes as { rowCount?: number }).rowCount === 0) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }
    const patientFacilityId = patientFacRes.rows[0]?.facility_id || null

    if (data.type === 'internal') {
      // If creator is assigned a facility, patient must belong to same facility (unless admin)
      if (creatorFacilityId) {
        if (!patientFacilityId && payload.role !== 'Hospital Admin') {
          return NextResponse.json({ error: 'Patient is not assigned to a facility. Cannot create internal referral.' }, { status: 403 })
        }
        if (patientFacilityId && patientFacilityId !== creatorFacilityId && payload.role !== 'Hospital Admin') {
          return NextResponse.json({ error: 'Cannot create internal referral for a patient outside your facility' }, { status: 403 })
        }
      } else {
        // Creator has no facility: require explicit facilityId in payload that matches patient (if patient has facility)
        if (data.facilityId && patientFacilityId && data.facilityId !== patientFacilityId) {
          return NextResponse.json({ error: 'Provided facility does not match patient facility' }, { status: 403 })
        }
      }
    }

    // Insert referral (include facility scoping)
    const facilityToInsert = creatorFacilityId || data.facilityId || null

    const handoffSnapshot = await buildHandoffSnapshot(data.patientId, data.clinicalRecordId)
    if (data.clinicalRecordId && !handoffSnapshot.latestClinicalRecord) {
      return NextResponse.json({ error: "Clinical record not found for this patient" }, { status: 400 })
    }
    const initialStatusHistory = JSON.stringify([
      {
        status: "pending",
        changedAt: new Date().toISOString(),
        changedBy: payload.sub,
      },
    ])

    const result = await query<{ id: string }>(
      `INSERT INTO referrals (
        patient_id, type, referring_user_id, referring_role, facility_id,
        receiving_user_id, receiving_department,
        external_facility_name, external_clinician_name, external_clinician_contact,
        reason, urgency, notes, handoff_snapshot, status_history
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb)
      RETURNING id`,
      [
        data.patientId,
        data.type,
        payload.sub,
        payload.role,
        facilityToInsert,
        data.receivingUserId || null,
        data.receivingDepartment || null,
        data.externalFacilityName || null,
        data.externalClinicianName || null,
        data.externalClinicianContact || null,
        data.reason,
        data.urgency,
        data.notes || null,
        JSON.stringify(handoffSnapshot),
        initialStatusHistory,
      ]
    )

    const referralId = result.rows[0].id

    // For internal referrals, notify the named recipient or the destination care team.
    if (data.type === 'internal') {
      try {
        const patientResult = await query<{ first_name: string; last_name: string }>(
          `SELECT first_name, last_name FROM patients WHERE id = $1`,
          [data.patientId]
        )
        const patientName = patientResult.rows[0]
          ? `${patientResult.rows[0].first_name} ${patientResult.rows[0].last_name}`
          : 'Patient'

        const targetRole = data.receivingDepartment === "Nurse" || data.receivingDepartment === "Midwife"
          ? data.receivingDepartment
          : null
        await query(
          `INSERT INTO notifications (user_id, department, role, title, message, type, priority, payload)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            data.receivingUserId || null,
            data.receivingUserId ? null : data.receivingDepartment || null,
            data.receivingUserId ? null : targetRole,
            "Clinical Handoff",
            `${referringUser?.name || "A colleague"} sent ${patientName} for care. Reason: ${data.reason}`,
            "Referral",
            data.urgency === "emergency" || data.urgency === "Very Urgent" ? "High" : "Standard",
            JSON.stringify({ patientId: data.patientId, referralId }),
          ],
        )
      } catch (notifError) {
        console.error('[referrals] Failed to send notification:', notifError)
        // Don't fail the referral creation if notification fails
      }
    }

    return NextResponse.json({ id: referralId, success: true })
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
    }
    console.error('[referrals] POST error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create referral' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!canAccessReferrals(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const url = new URL(req.url)
    const patientId = url.searchParams.get('patientId')
    const status = url.searchParams.get('status')
    const urgency = url.searchParams.get('urgency')

    const whereWithFilters = (baseClause: string, startIndex: number) => {
      const clauses = [baseClause]
      const params: string[] = []
      let idx = startIndex
      if (status) {
        clauses.push(`r.status = $${idx}`)
        params.push(status)
        idx += 1
      }
      if (urgency) {
        clauses.push(`r.urgency = $${idx}`)
        params.push(urgency)
        idx += 1
      }
      return { where: clauses.join(' AND '), extraParams: params }
    }

    if (patientId) {
      // Get referrals for a specific patient
      const facilityFilter = url.searchParams.get('facilityId')
      if (facilityFilter) {
        const filtered = whereWithFilters(`r.patient_id = $1 AND r.facility_id = $2`, 3)
        const result = await query<any>(
          `SELECT r.*, 
                  u1.name as referring_user_name,
                  u2.name as receiving_user_name
           FROM referrals r
           LEFT JOIN users u1 ON r.referring_user_id = u1.id
           LEFT JOIN users u2 ON r.receiving_user_id = u2.id
           WHERE ${filtered.where}
           ORDER BY r.created_at DESC`,
          [patientId, facilityFilter, ...filtered.extraParams]
        )

        return NextResponse.json({ referrals: result.rows })
      }

      const filtered = whereWithFilters(`r.patient_id = $1`, 2)
      const result = await query<any>(
        `SELECT r.*, 
                u1.name as referring_user_name,
                u2.name as receiving_user_name
         FROM referrals r
         LEFT JOIN users u1 ON r.referring_user_id = u1.id
         LEFT JOIN users u2 ON r.receiving_user_id = u2.id
         WHERE ${filtered.where}
         ORDER BY r.created_at DESC`,
        [patientId, ...filtered.extraParams]
      )

      return NextResponse.json({ referrals: result.rows })
    }

    // Get all referrals (for admins) or user's/referral scoped to facility
    if (payload.role === 'Hospital Admin') {
      const filtered = whereWithFilters(`1=1`, 1)
      const result = await query<any>(
        `SELECT r.*, 
                u1.name as referring_user_name,
                u2.name as receiving_user_name,
                p.first_name || ' ' || p.last_name as patient_name
         FROM referrals r
         LEFT JOIN users u1 ON r.referring_user_id = u1.id
         LEFT JOIN users u2 ON r.receiving_user_id = u2.id
         LEFT JOIN patients p ON r.patient_id = p.id
         WHERE ${filtered.where}
         ORDER BY r.created_at DESC
         LIMIT 100`,
        filtered.extraParams,
      )
      return NextResponse.json({ referrals: result.rows })
    }

    // For other users, return referrals related to them or their facility
    try {
      const userRow = await query<{ facility_id?: string }>(`SELECT facility_id FROM users WHERE id = $1`, [payload.sub])
      const facilityId = userRow.rows[0]?.facility_id || null

      const filtered = whereWithFilters(`(r.referring_user_id = $1 OR r.receiving_user_id = $1 OR (r.facility_id IS NOT NULL AND r.facility_id = $2))`, 3)

      const result = await query<any>(
        `SELECT r.*, 
                u1.name as referring_user_name,
                u2.name as receiving_user_name,
                p.first_name || ' ' || p.last_name as patient_name
         FROM referrals r
         LEFT JOIN users u1 ON r.referring_user_id = u1.id
         LEFT JOIN users u2 ON r.receiving_user_id = u2.id
         LEFT JOIN patients p ON r.patient_id = p.id
         WHERE ${filtered.where}
         ORDER BY r.created_at DESC
         LIMIT 100`,
        [payload.sub, facilityId, ...filtered.extraParams]
      )
      return NextResponse.json({ referrals: result.rows })
    } catch (e) {
      console.error('[referrals] GET user-scoped error', e)
      return NextResponse.json({ referrals: [] })
    }
  } catch (error: any) {
    console.error('[referrals] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 })
  }
}
