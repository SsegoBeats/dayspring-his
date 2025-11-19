import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: string
      medications?: {
        name?: string
        dosage?: string
        frequency?: string
        duration?: string
        instructions?: string
        quantity?: number
      }[]
    }

    const patientId = (body.patientId || "").trim()
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 })
    }

    const meds = Array.isArray(body.medications) ? body.medications : []
    const cleaned = meds
      .map((m) => ({
        name: (m.name || "").trim(),
        dosage: (m.dosage || "").trim(),
        frequency: (m.frequency || "").trim(),
        duration: (m.duration || "").trim(),
        instructions: (m.instructions || "").trim() || null,
        quantity: Number(m.quantity) || 1,
      }))
      .filter((m) => m.name && m.dosage && m.frequency && m.duration)

    if (!cleaned.length) {
      return NextResponse.json({ error: "At least one medication is required" }, { status: 400 })
    }

    const created: any[] = []

    for (const med of cleaned) {
      const { rows } = await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `INSERT INTO prescriptions (
           patient_id, doctor_id, medication_name, dosage, frequency, duration,
           instructions, quantity, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pending')
         RETURNING id, patient_id, doctor_id, medication_name, dosage, frequency, duration,
                   instructions, quantity, status, created_at`,
        [patientId, auth.userId, med.name, med.dosage, med.frequency, med.duration, med.instructions, med.quantity],
      )
      created.push(rows[0])
    }

    return NextResponse.json({ prescriptions: created })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to create prescription" }, { status: 500 })
  }
}

