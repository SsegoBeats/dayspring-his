import { query } from "@/lib/db"
import { formatPatientNumber } from "@/lib/patients"
import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { PrintButton } from "./PrintButton"
import { ORG_NAME, ORG_SUBTITLE } from "@/lib/org-constants"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return { title: "Patient Receipt" }

  const { id } = await params
  const { rows } = await query(`
    SELECT patient_number, first_name, last_name
    FROM patients
    WHERE id = $1
  `, [id])
  if (!rows || rows.length === 0) {
    return { title: "Patient Receipt - Not Found" }
  }
  const p = rows[0] as any
  const pid = formatPatientNumber(p.patient_number)
  return {
    title: `Patient Receipt - ${pid}`,
  }
}

export default async function PatientReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) redirect("/")

  const { id } = await params
  const { rows } = await query(`
    SELECT id, patient_number, first_name, last_name, phone, created_at
    FROM patients
    WHERE id = $1
  `, [id])
  if (!rows || rows.length === 0) return notFound()
  const p = rows[0] as any
  const pid = formatPatientNumber(p.patient_number)
  const created = p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : ""

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print { .no-print { display: none } }
        .receipt-container { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; padding: 24px; }
        .receipt-card { max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; }
        .receipt-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
        .receipt-muted { color: #6b7280; font-size: 12px; }
        .receipt-row { margin-top: 12px; display: flex; justify-content: space-between; }
        .receipt-pid { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 20px; letter-spacing: 2px; }
      `}} />
      <div className="receipt-container">
        <div className="receipt-card">
          <div className="receipt-title">{ORG_NAME} - {ORG_SUBTITLE}</div>
          <div className="receipt-muted">Patient Registration Receipt</div>
          <div className="receipt-row" style={{ marginTop: 16 }}>
            <div>
              <div><strong>Name:</strong> {p.first_name} {p.last_name}</div>
              <div><strong>Phone:</strong> {p.phone}</div>
              <div><strong>Date:</strong> {created}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="receipt-muted">Patient ID</div>
              <div className="receipt-pid">{pid}</div>
            </div>
          </div>
          <div className="receipt-muted" style={{ marginTop: 20 }}>
            Please keep this receipt safe. Present the P.ID at service points.
          </div>
          <div className="no-print">
            <PrintButton />
          </div>
        </div>
      </div>
    </>
  )
}
