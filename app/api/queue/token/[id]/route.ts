import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { queryWithSession } from "@/lib/db"
import { toPDF } from "@/lib/exports/writers/pdf"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT q.id as queue_id, q.department, q.status, q.position,
              c.id as checkin_id, c.created_at as checkin_time,
              p.patient_number, p.first_name, p.last_name, p.phone
         FROM checkins c
         LEFT JOIN queues q ON q.checkin_id = c.id
         JOIN patients p ON p.id = c.patient_id
        WHERE c.id = $1
        LIMIT 1`,
      [id]
    )
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const r: any = rows[0]

    const title = 'Dayspring Medical Center - Queue Token'
    const data = [
      { field: 'Patient', value: `${r.first_name} ${r.last_name}`.trim() },
      { field: 'Patient Number', value: r.patient_number },
      { field: 'Department', value: r.department || '-' },
      { field: 'Queue Position', value: r.position != null ? String(r.position) : '-' },
      { field: 'Check-in Time', value: new Date(r.checkin_time).toLocaleString() },
    ]

    // embed logo
    let logoDataUrl: string | undefined
    try {
      const origin = (() => {
        try { return new URL(req.url).origin } catch { return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000' }
      })()
      const resp = await fetch(`${origin}/logo0.png`)
      if (resp.ok) {
        const ct = resp.headers.get('content-type') || 'image/png'
        const ab = await resp.arrayBuffer()
        logoDataUrl = `data:${ct};base64,${Buffer.from(ab).toString('base64')}`
      }
    } catch {}

    const meta = {
      Token: r.queue_id || r.checkin_id,
      Department: r.department || '-',
    } as Record<string,string>

    const buf = await toPDF(title, data as any[], { userId: auth.userId, timestamp: new Date().toISOString() }, false, {
      colors: { headerBg: [14,165,233], headerText: [255,255,255], rowAltBg: [243,244,246], text: [17,24,39] },
      logoDataUrl,
      subtitle: 'Dayspring Medical Center - Information System',
      meta,
    })
    return new NextResponse(buf, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename=queue-token-${r.patient_number}.pdf` } })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
  }
}


