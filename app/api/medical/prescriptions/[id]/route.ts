import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // Pharmacists can update prescription status (dispense); all others need medical.update
    if (!can(auth.role, "medical", "update") && !can(auth.role, "pharmacy", "update"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const body = (await req.json().catch(() => ({}))) as {
      status?: "active" | "completed" | "cancelled"
    }

    const clientStatus = body.status
    if (!clientStatus) {
      return NextResponse.json({ error: "status is required" }, { status: 400 })
    }

    let dbStatus: string
    switch (clientStatus) {
      case "active":
        dbStatus = "Pending"
        break
      case "completed":
        dbStatus = "Dispensed"
        break
      case "cancelled":
        dbStatus = "Cancelled"
        break
      default:
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const isAdmin = auth.role === "Hospital Admin"
    const hasMedicalUpdate = can(auth.role, "medical", "update")
    const hasPharmacyUpdate = can(auth.role, "pharmacy", "update")

    const whereScope = isAdmin
      ? "id = $3"
      : hasPharmacyUpdate && !hasMedicalUpdate
        ? "id = $3"
        : "id = $3 AND doctor_id = $4"

    const updateParams = whereScope.includes("$4")
      ? [dbStatus, auth.userId, id, auth.userId]
      : [dbStatus, auth.userId, id]

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE prescriptions
          SET status = $1,
              dispensed_by = CASE WHEN $1 = 'Dispensed' THEN $2 ELSE dispensed_by END,
              dispensed_at = CASE WHEN $1 = 'Dispensed' THEN NOW() ELSE dispensed_at END
        WHERE ${whereScope}
        RETURNING id, patient_id, doctor_id, medication_name, dosage, frequency, duration,
                  instructions, quantity, status, dispensed_by, dispensed_at, created_at`,
      updateParams,
    )

    if (!rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ prescription: rows[0] })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to update prescription" }, { status: 500 })
  }
}

