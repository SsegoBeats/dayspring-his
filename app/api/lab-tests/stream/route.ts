import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const enc = new TextEncoder()
  let lastHash = ''
  async function load() {
    let patientFilter = ''
    let params: any[] = []
    try { const u = new URL(req.url); const pid = u.searchParams.get('patientId'); if (pid) { patientFilter = 'WHERE lt.patient_id = $1'; params.push(pid) } } catch {}
    const { rows } = await query(
      `SELECT lt.id, lt.patient_id, p.first_name, p.last_name, p.gender, p.date_of_birth, lt.doctor_id, d.name AS doctor_name,
              lt.test_name, lt.test_type, lt.status, lt.results, lt.notes, lt.lab_tech_id, t.name AS lab_tech_name,
              lt.ordered_at, lt.completed_at, lt.priority, lt.specimen_type, lt.accession_number, lt.collected_at, lt.collected_by,
              lt.reviewed_by, lt.reviewed_at
         FROM lab_tests lt
         LEFT JOIN patients p ON p.id = lt.patient_id
         LEFT JOIN users d ON d.id = lt.doctor_id
         LEFT JOIN users t ON t.id = lt.lab_tech_id
        ${patientFilter}
        ORDER BY COALESCE(lt.completed_at, lt.ordered_at) DESC
        LIMIT 500`, params)
    const tests = rows.map((r:any)=>({
      id: r.id,
      patientId: r.patient_id,
      patientName: [r.first_name, r.last_name].filter(Boolean).join(' '),
      doctorId: r.doctor_id,
      doctorName: r.doctor_name || '',
      testName: r.test_name,
      testType: r.test_type,
      status: r.status,
      results: r.results || '',
      notes: r.notes || '',
      labTechId: r.lab_tech_id || null,
      labTechName: r.lab_tech_name || '',
      orderedAt: r.ordered_at,
      completedAt: r.completed_at || null,
      priority: r.priority || 'Routine',
      specimenType: r.specimen_type || null,
      accessionNumber: r.accession_number || null,
      collectedAt: r.collected_at || null,
      collectedBy: r.collected_by || null,
      reviewedBy: r.reviewed_by || null,
      reviewedAt: r.reviewed_at || null,
      patientGender: r.gender || null,
      patientDob: r.date_of_birth || null,
    }))
    const payload = JSON.stringify({ tests })
    const hash = String(payload.length) // quick hash
    return { payload, hash }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let timer: any
      let closed = false
      const send = async () => {
        if (closed) return
        try {
          const { payload, hash } = await load()
          if (hash !== lastHash) {
            lastHash = hash
            controller.enqueue(enc.encode(`data: ${payload}\n\n`))
          }
        } catch {
          // emit error event but keep connection
          try { controller.enqueue(enc.encode(`event: error\n`+`data: {"message":"stream error"}\n\n`)) } catch {}
        }
      }
      await send()
      timer = setInterval(send, 15000)
      ;(controller as any)._timer = timer
      ;(controller as any)._closed = () => (closed = true)
    },
    cancel() { const t = (this as any)._timer; if (t) clearInterval(t); const c = (this as any)._closed; if (c) c() }
  })
  return new NextResponse(stream as any, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' }
  })
}
