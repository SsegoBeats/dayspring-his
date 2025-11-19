import { query } from "@/lib/db"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { PrintButton } from "./PrintButton"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
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
  const pid = String(p.patient_number || "").replace(/\D/g, "").slice(-4).padStart(4, "0")
  return {
    title: `Patient Receipt - ${pid}`,
  }
}

export default async function PatientReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { rows } = await query(`
    SELECT id, patient_number, first_name, last_name, phone, created_at
    FROM patients
    WHERE id = $1
  `, [id])
  if (!rows || rows.length === 0) return notFound()
  const p = rows[0] as any
  const pid = String(p.patient_number || "").replace(/\D/g, "").slice(-4).padStart(4, "0")
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
          <div className="receipt-title">Dayspring Medical Center - Information System</div>
          <div className="receipt-muted">Patient Registration Receipt</div>
          <div className="receipt-row" style={{ marginTop: 16 }}>
            <div>
              <div><strong>Name:</strong> {p.first_name} {p.last_name}</div>
              <div><strong>Phone:</strong> {p.phone}</div>
              <div><strong>Date:</strong> {created}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="receipt-muted">P.ID</div>
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
