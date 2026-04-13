import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"

function toInt(val: any): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? Math.trunc(val) : null
  const m = String(val).match(/-?\d+/)
  return m ? parseInt(m[0], 10) : null
}

function toFloat(val: any): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? val : null
  const m = String(val).replace(",", ".").match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

function parseBloodPressure(bp: any): { sys: number | null; dia: number | null } {
  if (!bp) return { sys: null, dia: null }
  const s = String(bp)
  const parts = s.split(/[\/\-\s]+/)
  if (parts.length >= 2) {
    const sys = toInt(parts[0])
    const dia = toInt(parts[1])
    return { sys, dia }
  }
  const nums = s.match(/\d+/g)
  if (nums && nums.length >= 2) {
    return { sys: toInt(nums[0]), dia: toInt(nums[1]) }
  }
  return { sys: toInt(bp), dia: null }
}

async function ensureSchema() {
  try {
    await query("ALTER TABLE vital_signs ADD COLUMN IF NOT EXISTS notes TEXT")
    await query("CREATE INDEX IF NOT EXISTS idx_vitals_patient_recorded ON vital_signs(patient_id, recorded_at DESC)")
  } catch {}
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth || !can(auth.role, "medical", "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const patientId = url.searchParams.get("patientId")
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 200)))
    if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 })

    await ensureSchema()

    const { rows } = await query(
      `SELECT vs.id, vs.patient_id, vs.nurse_id,
              vs.blood_pressure_systolic, vs.blood_pressure_diastolic,
              vs.heart_rate, vs.temperature, vs.respiratory_rate,
              vs.oxygen_saturation, vs.weight, vs.height, vs.notes,
              COALESCE(vs.recorded_at, NOW()) AS recorded_at,
              p.first_name, p.last_name,
              u.name AS nurse_name
         FROM vital_signs vs
         LEFT JOIN patients p ON p.id = vs.patient_id
         LEFT JOIN users u ON u.id = vs.nurse_id
        WHERE vs.patient_id = $1
        ORDER BY COALESCE(vs.recorded_at, NOW()) DESC
        LIMIT $2`,
      [patientId, limit]
    )

    const vitals = rows.map((r: any) => {
      const d = new Date(r.recorded_at)
      const date = d.toISOString().slice(0, 10)
      const time = d.toTimeString().slice(0, 5)
      const bloodPressure = r.blood_pressure_systolic && r.blood_pressure_diastolic
        ? `${r.blood_pressure_systolic}/${r.blood_pressure_diastolic}`
        : r.blood_pressure_systolic ? String(r.blood_pressure_systolic) : ""
      return {
        id: r.id,
        patientId: r.patient_id,
        patientName: [r.first_name, r.last_name].filter(Boolean).join(" "),
        nurseName: r.nurse_name || "",
        date,
        time,
        bloodPressure,
        temperature: r.temperature != null ? String(r.temperature) : "",
        heartRate: r.heart_rate != null ? String(r.heart_rate) : "",
        respiratoryRate: r.respiratory_rate != null ? String(r.respiratory_rate) : "",
        oxygenSaturation: r.oxygen_saturation != null ? String(r.oxygen_saturation) : "",
        weight: r.weight != null ? String(r.weight) : "",
        height: r.height != null ? String(r.height) : "",
        notes: r.notes || "",
      }
    })
    return NextResponse.json({ vitals })
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to load vitals", details: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth || !can(auth.role, "medical", "create")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await ensureSchema()
    const body = await req.json().catch(() => ({}))
    const patientId = body.patientId as string
    if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 })

    const { sys, dia } = parseBloodPressure(body.bloodPressure)
    const temperature = toFloat(body.temperature)
    const heartRate = toInt(body.heartRate)
    const respiratoryRate = toInt(body.respiratoryRate)
    const oxygenSaturation = toInt(body.oxygenSaturation)
    const weight = toFloat(body.weight)
    const height = toFloat(body.height)
    const notes = (body.notes ?? null) as string | null

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO vital_signs (
          patient_id, nurse_id, blood_pressure_systolic, blood_pressure_diastolic,
          heart_rate, temperature, respiratory_rate, oxygen_saturation,
          weight, height, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id, COALESCE(recorded_at, NOW()) AS recorded_at`,
      [
        patientId,
        auth.userId,
        sys,
        dia,
        heartRate,
        temperature,
        respiratoryRate,
        oxygenSaturation,
        weight,
        height,
        notes,
      ]
    )

    const id = rows[0].id
    const ts = new Date(rows[0].recorded_at)
    return NextResponse.json({ id, recordedAt: ts.toISOString() })
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to record vitals", details: e.message }, { status: 500 })
  }
}
