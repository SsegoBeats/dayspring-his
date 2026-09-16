import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/security"
import { z } from "zod"
import { ensureNotificationInfrastructure } from "@/lib/notifications"

const CreateReferralSchema = z.object({
  patientId: z.string().uuid(),
  type: z.enum(['internal', 'external-out', 'external-in']),
  receivingUserId: z.string().uuid().optional(),
  receivingDepartment: z.string().optional(),
  externalFacilityName: z.string().optional(),
  externalClinicianName: z.string().optional(),
  externalClinicianContact: z.string().optional(),
  facilityId: z.string().uuid().optional(),
  reason: z.string().min(1),
  urgency: z.enum(['emergency', 'Very Urgent', 'urgent', 'routine', 'low']).default('routine'),
  notes: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const token = req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1] || 
                  req.headers.get("cookie")?.match(/session_dev=([^;]+)/)?.[1]
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || !['Clinician', 'Nurse', 'Hospital Admin'].includes(payload.role)) {
      return NextResponse.json({ 
        error: "Only Clinicians, Nurses, and Admins can create referrals" 
      }, { status: 403 })
    }

    const body = await req.json()
    const data = CreateReferralSchema.parse(body)

    // Validate internal referral has receiving user
    if (data.type === 'internal' && !data.receivingUserId) {
      return NextResponse.json({ 
        error: "Internal referrals require a receiving clinician" 
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
    if (patientFacRes.rowCount === 0) {
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

    const result = await query<{ id: string }>(
      `INSERT INTO referrals (
        patient_id, type, referring_user_id, referring_role, facility_id,
        receiving_user_id, receiving_department,
        external_facility_name, external_clinician_name, external_clinician_contact,
        reason, urgency, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
      ]
    )

    const referralId = result.rows[0].id

    // For internal referrals, send notification to receiving clinician
    if (data.type === 'internal' && data.receivingUserId) {
      try {
        const patientResult = await query<{ first_name: string; last_name: string }>(
          `SELECT first_name, last_name FROM patients WHERE id = $1`,
          [data.patientId]
        )
        const patientName = patientResult.rows[0]
          ? `${patientResult.rows[0].first_name} ${patientResult.rows[0].last_name}`
          : 'Patient'

        await ensureNotificationInfrastructure({
          userId: data.receivingUserId,
          title: 'New Patient Referral',
          message: `${referringUser?.name || 'A colleague'} has referred ${patientName} to you. Reason: ${data.reason}`,
          type: 'Referral',
          priority: data.urgency === 'emergency' || data.urgency === 'Very Urgent' ? 'High' : 'Standard',
          relatedPatientId: data.patientId,
          payload: { referralId },
        })
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
    const token = req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1] || 
                  req.headers.get("cookie")?.match(/session_dev=([^;]+)/)?.[1]
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const patientId = url.searchParams.get('patientId')

    if (patientId) {
      // Get referrals for a specific patient
      const facilityFilter = url.searchParams.get('facilityId')
      if (facilityFilter) {
        const result = await query<any>(
          `SELECT r.*, 
                  u1.name as referring_user_name,
                  u2.name as receiving_user_name
           FROM referrals r
           LEFT JOIN users u1 ON r.referring_user_id = u1.id
           LEFT JOIN users u2 ON r.receiving_user_id = u2.id
           WHERE r.patient_id = $1 AND r.facility_id = $2
           ORDER BY r.created_at DESC`,
          [patientId, facilityFilter]
        )

        return NextResponse.json({ referrals: result.rows })
      }

      const result = await query<any>(
        `SELECT r.*, 
                u1.name as referring_user_name,
                u2.name as receiving_user_name
         FROM referrals r
         LEFT JOIN users u1 ON r.referring_user_id = u1.id
         LEFT JOIN users u2 ON r.receiving_user_id = u2.id
         WHERE r.patient_id = $1
         ORDER BY r.created_at DESC`,
        [patientId]
      )

      return NextResponse.json({ referrals: result.rows })
    }

    // Get all referrals (for admins) or user's/referral scoped to facility
    if (payload.role === 'Hospital Admin') {
      const result = await query<any>(
        `SELECT r.*, 
                u1.name as referring_user_name,
                u2.name as receiving_user_name,
                p.first_name || ' ' || p.last_name as patient_name
         FROM referrals r
         LEFT JOIN users u1 ON r.referring_user_id = u1.id
         LEFT JOIN users u2 ON r.receiving_user_id = u2.id
         LEFT JOIN patients p ON r.patient_id = p.id
         ORDER BY r.created_at DESC
         LIMIT 100`
      )
      return NextResponse.json({ referrals: result.rows })
    }

    // For other users, return referrals related to them or their facility
    try {
      const userRow = await query<{ facility_id?: string }>(`SELECT facility_id FROM users WHERE id = $1`, [payload.sub])
      const facilityId = userRow.rows[0]?.facility_id || null

      const result = await query<any>(
        `SELECT r.*, 
                u1.name as referring_user_name,
                u2.name as receiving_user_name,
                p.first_name || ' ' || p.last_name as patient_name
         FROM referrals r
         LEFT JOIN users u1 ON r.referring_user_id = u1.id
         LEFT JOIN users u2 ON r.receiving_user_id = u2.id
         LEFT JOIN patients p ON r.patient_id = p.id
         WHERE r.referring_user_id = $1 OR r.receiving_user_id = $1 OR (r.facility_id IS NOT NULL AND r.facility_id = $2)
         ORDER BY r.created_at DESC
         LIMIT 100`,
        [payload.sub, facilityId]
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
