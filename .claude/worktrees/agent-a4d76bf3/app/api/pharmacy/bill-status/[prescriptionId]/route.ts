import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"

// GET /api/pharmacy/bill-status/:prescriptionId
// Pharmacist calls this on the dispense screen to check whether an OPD bill has been paid.
// Returns { bill: { id, billNumber, status, finalAmount, paidAt } } or { bill: null } if no bill exists.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ prescriptionId: string }> },
) {
  try {
    const { prescriptionId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Also fetch prescription visit_type so the frontend knows which flow applies
    const { rows: [prescription] } = await query(
      `SELECT id, visit_type FROM prescriptions WHERE id = $1`,
      [prescriptionId],
    )
    if (!prescription) return NextResponse.json({ error: "Prescription not found" }, { status: 404 })

    const { rows: [bill] } = await query(
      `SELECT id, bill_number, status, final_amount, paid_at
         FROM bills
        WHERE prescription_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [prescriptionId],
    )

    return NextResponse.json({
      visitType: prescription.visit_type,
      bill: bill
        ? {
            id: bill.id,
            billNumber: bill.bill_number,
            status: bill.status,
            finalAmount: Number(bill.final_amount),
            paidAt: bill.paid_at,
          }
        : null,
    })
  } catch (err: any) {
    console.error("bill-status error:", err)
    return NextResponse.json({ error: "Failed to fetch bill status" }, { status: 500 })
  }
}
