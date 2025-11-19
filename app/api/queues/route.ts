import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth || !can(auth.role, "queues", "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  const department = url.searchParams.get("department")
  const status = url.searchParams.get("status") || 'waiting'
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT q.id, q.department, q.status, q.priority, q.position, q.updated_at,
            c.id as checkin_id, c.status as checkin_status, c.created_at as checkin_time,
            p.id as patient_id, p.first_name, p.last_name, p.patient_number,
            CASE WHEN q.status = 'waiting' THEN EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 60.0 ELSE NULL END AS waiting_minutes,
            CASE WHEN q.status = 'in_service' THEN (
              SELECT EXTRACT(EPOCH FROM (NOW() - e.created_at)) / 60.0
              FROM queue_events e
              WHERE e.queue_id = q.id AND e.to_status = 'in_service'
              ORDER BY e.created_at DESC
              LIMIT 1
            ) ELSE NULL END AS in_service_minutes
       FROM queues q
       JOIN checkins c ON c.id = q.checkin_id
       JOIN patients p ON p.id = c.patient_id
      WHERE ($1::text IS NULL OR q.department = $1)
        AND q.status = $2
      ORDER BY q.priority DESC, q.position ASC, q.updated_at ASC`,
    [department, status]
  )
  return NextResponse.json({ queue: rows })
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "queues", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const Create = z.object({ department: z.string().min(2), checkinId: z.string().uuid(), priority: z.number().int().min(0).optional() })
    const data = Create.parse(await req.json())
    const values = [data.department, data.checkinId, data.priority ?? 0]
    values.push(data.department)
    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO queues (department, checkin_id, status, priority, position)
       VALUES ($1,$2,'waiting',$3,(SELECT COALESCE(MAX(position),0)+1 FROM queues WHERE department=$4 AND status='waiting'))
       RETURNING id`,
      values,
    )
    const id = rows[0].id as string
    await writeAuditLog({ userId: auth.userId, action: "QUEUE_ADD", entityType: "Queue", entityId: id, details: data })
    return NextResponse.json({ id })
  } catch (err: any) {
    if (err?.name === "ZodError") return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Failed to add to queue" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "queues", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    const body = await req.json()
    const Update = z.object({
      action: z.enum(['advance','cancel','start','done','waiting','reorder','top']),
      priority: z.number().int().min(0).optional(),
      targetId: z.string().uuid().optional(),
      place: z.enum(['before','after']).optional(),
      department: z.string().optional(),
      statusCtx: z.enum(['waiting','in_service','done','cancelled']).optional(),
    })
    const data = Update.parse(body)

    let status: string | null = null
    if (data.action === 'advance' || data.action === 'start') status = 'in_service'
    if (data.action === 'done') status = 'done'
    if (data.action === 'cancel') status = 'cancelled'
    if (data.action === 'waiting') status = 'waiting'

    if (status) {
      // Fetch previous status for event log
      const prev = await queryWithSession<any>({ role: auth.role, userId: auth.userId }, `SELECT status FROM queues WHERE id=$1`, [id])
      await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `UPDATE queues SET status=$1, updated_at=NOW() WHERE id=$2`,
        [status, id]
      )
      try {
        const fromStatus = prev.rows?.[0]?.status || null
        await queryWithSession({ role: auth.role, userId: auth.userId },
          `INSERT INTO queue_events (queue_id, from_status, to_status) VALUES ($1,$2,$3)`,
          [id, fromStatus, status]
        )
      } catch {}
    }
    if (typeof data.priority === 'number') {
      await queryWithSession({ role: auth.role, userId: auth.userId }, `UPDATE queues SET priority=$1 WHERE id=$2`, [data.priority, id])
    }
    if (data.action === 'top') {
      const dept = data.department || null
      const st = data.statusCtx || 'waiting'
      // Shift positions down and set this id to 1
      await queryWithSession({ role: auth.role, userId: auth.userId },
        `UPDATE queues SET position = position + 1 WHERE ($1::text IS NULL OR department=$1) AND status=$2`, [dept, st])
      await queryWithSession({ role: auth.role, userId: auth.userId },
        `UPDATE queues SET position = 1, updated_at = NOW() WHERE id=$1`, [id])
    }
    if (data.action === 'reorder' && data.targetId && data.place) {
      // Fetch context list, splice, and renumber
      const dept = data.department || null
      const st = data.statusCtx || 'waiting'
      const { rows: list } = await queryWithSession<any>({ role: auth.role, userId: auth.userId },
        `SELECT id FROM queues WHERE ($1::text IS NULL OR department=$1) AND status=$2 ORDER BY position ASC, updated_at ASC`,
        [dept, st]
      )
      const ids = list.map((r: any) => r.id)
      const fromIdx = ids.indexOf(id)
      const toIdx = ids.indexOf(data.targetId)
      if (fromIdx !== -1 && toIdx !== -1) {
        ids.splice(fromIdx, 1)
        const insertAt = data.place === 'before' ? toIdx : toIdx + 1
        ids.splice(insertAt > ids.length ? ids.length : insertAt, 0, id)
        for (let i = 0; i < ids.length; i++) {
          await queryWithSession({ role: auth.role, userId: auth.userId }, `UPDATE queues SET position=$1, updated_at=NOW() WHERE id=$2`, [i + 1, ids[i]])
        }
      }
    } else if (data.action === 'reorder' && !data.targetId) {
      // Append to end of lane
      const dept = data.department || null
      const st = data.statusCtx || 'waiting'
      const { rows: maxPos } = await queryWithSession<any>({ role: auth.role, userId: auth.userId }, `SELECT COALESCE(MAX(position),0)+1 AS nextpos FROM queues WHERE ($1::text IS NULL OR department=$1) AND status=$2`, [dept, st])
      const nextpos = Number(maxPos?.[0]?.nextpos || 1)
      await queryWithSession({ role: auth.role, userId: auth.userId }, `UPDATE queues SET position=$1, updated_at=NOW() WHERE id=$2`, [nextpos, id])
    }
    await writeAuditLog({ userId: auth.userId, action: "QUEUE_UPDATE", entityType: "Queue", entityId: id, details: data })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err?.name === "ZodError") return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Failed to update queue" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "queues", "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const { rows } = await queryWithSession<any>(
      { role: auth.role, userId: auth.userId },
      `SELECT status FROM queues WHERE id = $1`,
      [id],
    )
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (rows[0].status !== "done") return NextResponse.json({ error: "Only completed entries can be removed" }, { status: 400 })

    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `DELETE FROM queues WHERE id = $1`,
      [id],
    )
    await writeAuditLog({ userId: auth.userId, action: "QUEUE_DELETE", entityType: "Queue", entityId: id, details: { status: "done" } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to delete queue entry" }, { status: 500 })
  }
}
