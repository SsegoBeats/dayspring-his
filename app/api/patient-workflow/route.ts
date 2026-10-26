import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession, withSession } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

type Role =
  | "Receptionist"
  | "Clinician"
  | "Radiologist"
  | "Nurse"
  | "Lab Tech"
  | "Hospital Admin"
  | "Cashier"
  | "Pharmacist"
  | "Midwife"
  | "Dentist"

const roleDepartments: Record<Role, string[]> = {
  Receptionist: ["reception", "triage", "nurse", "general", "dental", "emergency", "pediatrics", "surgery", "radiology", "laboratory", "lab"],
  Clinician: ["clinician", "doctor", "general", "emergency", "pediatrics", "surgery"],
  Radiologist: ["radiology"],
  Nurse: ["triage", "nurse"],
  "Lab Tech": ["lab", "laboratory"],
  "Hospital Admin": [],
  Cashier: ["cashier"],
  Pharmacist: ["pharmacy"],
  Midwife: ["midwife", "triage", "labor", "postnatal", "immunization", "family planning"],
  Dentist: ["dentist", "dental"],
}

const roleDestinations: Record<Role, string[]> = {
  Receptionist: ["triage", "nurse", "clinician", "doctor", "general", "dental", "emergency", "pediatrics", "surgery", "radiology", "laboratory", "lab"],
  Clinician: ["laboratory", "lab", "radiology", "pharmacy", "nurse", "midwife", "dental", "discharged"],
  Radiologist: ["clinician", "doctor"],
  Nurse: ["clinician", "doctor", "midwife"],
  "Lab Tech": ["clinician", "doctor"],
  "Hospital Admin": ["triage", "nurse", "clinician", "doctor", "general", "dental", "emergency", "pediatrics", "surgery", "radiology", "laboratory", "lab", "pharmacy", "cashier", "midwife", "postnatal", "immunization", "family planning"],
  Cashier: ["clinician", "doctor"],
  Pharmacist: ["clinician", "doctor"],
  Midwife: ["laboratory", "lab", "radiology", "pharmacy", "clinician", "doctor", "postnatal", "immunization", "family planning", "discharged"],
  Dentist: ["laboratory", "lab", "radiology", "pharmacy", "clinician", "doctor", "discharged"],
}

const departmentLabels: Record<string, string> = {
  triage: "Triage",
  nurse: "Nurse",
  clinician: "Clinician",
  doctor: "Doctor",
  general: "General",
  dental: "Dental",
  emergency: "Emergency",
  pediatrics: "Pediatrics",
  surgery: "Surgery",
  radiology: "Radiology",
  laboratory: "Laboratory",
  lab: "Lab",
  pharmacy: "Pharmacy",
  cashier: "Cashier",
  midwife: "Midwife",
  labor: "Labor",
  postnatal: "Postnatal",
  immunization: "Immunization",
  "family planning": "Family Planning",
  discharged: "Discharged",
}

const AcknowledgeSchema = z.object({
  routingId: z.string().uuid(),
})

const HandoffSchema = z.object({
  routingId: z.string().uuid(),
  toDepartment: z.string().trim().min(2).max(100),
  reason: z.string().trim().max(1000).optional(),
})

function normalizeDepartment(value: string) {
  return value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ")
}

function getRole(authRole: string): Role | null {
  return Object.prototype.hasOwnProperty.call(roleDepartments, authRole) ? (authRole as Role) : null
}

function canManageWorkflow(role: string) {
  return (
    can(role, "checkins", "update") ||
    can(role, "medical", "create") ||
    can(role, "medical", "update") ||
    can(role, "lab", "update") ||
    can(role, "radiology", "update") ||
    can(role, "pharmacy", "update") ||
    can(role, "payments", "create")
  )
}

function getDestinations(role: Role) {
  return roleDestinations[role].map((department) => departmentLabels[department])
}

async function getAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const role = getRole(auth.role)
    if (!role || !(can(auth.role, "patients", "read") || can(auth.role, "checkins", "read") || can(auth.role, "medical", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const url = new URL(req.url)
    const patientId = url.searchParams.get("patientId")
    const session = { role: auth.role, userId: auth.userId }

    if (patientId) {
      const patientIdResult = z.string().uuid().safeParse(patientId)
      if (!patientIdResult.success) return NextResponse.json({ error: "Invalid patientId" }, { status: 400 })
      const { rows } = await queryWithSession(
        session,
        `SELECT r.id, r.patient_id, r.checkin_id, r.from_department, r.to_department,
                r.routed_by, u.name AS routed_by_name, r.reason, r.priority, r.status,
                r.created_at, r.acknowledged_at, r.completed_at
           FROM patient_routing r
           LEFT JOIN users u ON u.id = r.routed_by
          WHERE r.patient_id = $1
          ORDER BY r.created_at ASC
          LIMIT 200`,
        [patientId],
      )
      return NextResponse.json({ history: rows })
    }

    const departments = roleDepartments[role]
    const { rows } = await queryWithSession(
      session,
      `SELECT r.id, r.patient_id, r.checkin_id, r.from_department, r.to_department,
              r.routed_by, r.reason, r.priority, r.status, r.created_at, r.acknowledged_at,
              p.patient_number, p.first_name, p.last_name, p.date_of_birth, p.gender
         FROM patient_routing r
         JOIN patients p ON p.id = r.patient_id
        WHERE r.status IN ('Pending', 'Acknowledged')
          AND ($1::boolean OR LOWER(TRIM(r.to_department)) = ANY($2::text[]))
        ORDER BY CASE r.priority
                   WHEN 'Emergency' THEN 1
                   WHEN 'Very Urgent' THEN 2
                   WHEN 'Urgent' THEN 3
                   ELSE 4
                 END,
                 r.created_at ASC
        LIMIT 200`,
      [role === "Hospital Admin", departments],
    )
    return NextResponse.json({ routes: rows, destinations: getDestinations(role) })
  } catch (error) {
    console.error("Failed to fetch patient workflow:", error)
    return NextResponse.json({ error: "Failed to fetch patient workflow" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const role = getRole(auth.role)
    if (!role || !canManageWorkflow(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = AcknowledgeSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: "Invalid routingId" }, { status: 400 })
    const departments = roleDepartments[role]
    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE patient_routing
          SET status = 'Acknowledged', acknowledged_at = NOW()
        WHERE id = $1
          AND status = 'Pending'
          AND ($2::boolean OR LOWER(TRIM(to_department)) = ANY($3::text[]))
        RETURNING id, patient_id, checkin_id, from_department, to_department, status, acknowledged_at`,
      [parsed.data.routingId, role === "Hospital Admin", departments],
    )
    if (!rows[0]) return NextResponse.json({ error: "Pending handoff not found for your department" }, { status: 404 })

    await writeAuditLog({
      userId: auth.userId,
      action: "PATIENT_HANDOFF_ACKNOWLEDGE",
      entityType: "PatientRouting",
      entityId: parsed.data.routingId,
      details: { patientId: rows[0].patient_id, department: rows[0].to_department },
    })
    return NextResponse.json({ route: rows[0] })
  } catch (error) {
    console.error("Failed to acknowledge patient handoff:", error)
    return NextResponse.json({ error: "Failed to acknowledge patient handoff" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const role = getRole(auth.role)
    if (!role || !canManageWorkflow(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = HandoffSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: "Invalid handoff details", details: parsed.error.issues }, { status: 400 })
    const destination = normalizeDepartment(parsed.data.toDepartment)
    const canRoute = roleDestinations[role].includes(destination)
    if (!canRoute) return NextResponse.json({ error: "You cannot route patients to that department" }, { status: 403 })

    const result = await withSession({ role: auth.role, userId: auth.userId }, async (client) => {
      const { rows: activeRows } = await client.query(
        `SELECT id, patient_id, checkin_id, to_department, priority
           FROM patient_routing
          WHERE id = $1 AND status IN ('Pending', 'Acknowledged')
          FOR UPDATE`,
        [parsed.data.routingId],
      )
      const active = activeRows[0]
      if (!active) return null
      if (role !== "Hospital Admin" && !roleDepartments[role].includes(normalizeDepartment(active.to_department))) {
        return null
      }

      const label = departmentLabels[destination] || parsed.data.toDepartment.trim()
      await client.query(
        `UPDATE patient_routing SET status = 'Completed', completed_at = NOW() WHERE id = $1`,
        [active.id],
      )

      let nextRoute
      if (destination === "discharged") {
        const { rows } = await client.query(
          `INSERT INTO patient_routing
             (patient_id, checkin_id, from_department, to_department, routed_by, reason, priority, status, completed_at)
           VALUES ($1, $2, $3, 'Discharged', $4, $5, $6, 'Completed', NOW())
           RETURNING id, patient_id, checkin_id, from_department, to_department, reason, priority, status, created_at, completed_at`,
          [active.patient_id, active.checkin_id, active.to_department, auth.userId, parsed.data.reason || null, active.priority],
        )
        nextRoute = rows[0]
        await client.query(
          `UPDATE patients
              SET current_location = 'Discharged', current_status = 'Discharged', updated_at = NOW()
            WHERE id = $1`,
          [active.patient_id],
        )
      } else {
        const { rows } = await client.query(
          `INSERT INTO patient_routing
             (patient_id, checkin_id, from_department, to_department, routed_by, reason, priority, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')
           RETURNING id, patient_id, checkin_id, from_department, to_department, reason, priority, status, created_at`,
          [active.patient_id, active.checkin_id, active.to_department, label, auth.userId, parsed.data.reason || null, active.priority],
        )
        nextRoute = rows[0]
        await client.query(
          `UPDATE patients
              SET current_location = $1, current_status = 'In Progress', updated_at = NOW()
            WHERE id = $2`,
          [label, active.patient_id],
        )
      }
      return { completedRouteId: active.id, route: nextRoute, patientId: active.patient_id }
    })

    if (!result) return NextResponse.json({ error: "Active handoff not found for your department" }, { status: 404 })
    await writeAuditLog({
      userId: auth.userId,
      action: "PATIENT_HANDOFF_ROUTE",
      entityType: "PatientRouting",
      entityId: result.route.id,
      details: {
        patientId: result.patientId,
        fromRoutingId: result.completedRouteId,
        toDepartment: result.route.to_department,
      },
    })
    return NextResponse.json({ route: result.route })
  } catch (error) {
    console.error("Failed to route patient handoff:", error)
    return NextResponse.json({ error: "Failed to route patient handoff" }, { status: 500 })
  }
}
