import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!can(auth.role, "patients", "read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `select id, patient_number as mrn, first_name, last_name, phone, gender, date_of_birth as dob from patients where id=$1`,
    [id]
  )
  const p = rows[0]
  if (!p) return NextResponse.json({ resourceType: "OperationOutcome", issue: [{ severity: "error", diagnostics: "not found" }] }, { status: 404 })

  const fhir = {
    resourceType: "Patient",
    id: p.id,
    identifier: [{ system: "MRN", value: p.mrn }],
    name: [{ family: p.last_name, given: [p.first_name] }],
    telecom: [{ system: "phone", value: p.phone }],
    gender: p.gender,
    birthDate: String(p.dob).slice(0, 10),
  }
  return NextResponse.json(fhir)
}



