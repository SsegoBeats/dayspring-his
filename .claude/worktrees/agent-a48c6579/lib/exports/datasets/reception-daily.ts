import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const Filter = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  department: z.string().optional(),
})

export class ReceptionDailyDataset implements Dataset {
  name = "reception_daily"
  defaultColumns = ["section", "metric", "value"]
  validateFilters(input: any) { return Filter.parse(input) }
  async queryPage(ctx: ExportContext, f: z.infer<typeof Filter>) {
    const dept = f.department ?? null
    const rows: Array<{ section: string; metric: string; value: string }> = []

    // Register-style sections
    const checkins = await query(
      `SELECT 
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='Arrived')::int AS arrived,
          COUNT(*) FILTER (WHERE status='With Nurse')::int AS with_nurse,
          COUNT(*) FILTER (WHERE status='In Room')::int AS in_room,
          COUNT(*) FILTER (WHERE status='Complete')::int AS complete,
          COUNT(*) FILTER (WHERE status='Cancelled')::int AS cancelled
       FROM checkins c
       WHERE c.created_at >= $1 AND c.created_at <= $2`,
      [f.from, f.to]
    )
    const ci = (checkins.rows?.[0] as any) || {}
    rows.push({ section: 'Register - Check-ins', metric: 'Total', value: String(ci.total ?? 0) })
    rows.push({ section: 'Register - Check-ins', metric: 'Arrived', value: String(ci.arrived ?? 0) })
    rows.push({ section: 'Register - Check-ins', metric: 'With Nurse', value: String(ci.with_nurse ?? 0) })
    rows.push({ section: 'Register - Check-ins', metric: 'In Room', value: String(ci.in_room ?? 0) })
    rows.push({ section: 'Register - Check-ins', metric: 'Complete', value: String(ci.complete ?? 0) })
    rows.push({ section: 'Register - Check-ins', metric: 'Cancelled', value: String(ci.cancelled ?? 0) })

    const queue = await query(
      `SELECT 
          COUNT(*) FILTER (WHERE status='waiting')::int AS waiting,
          COUNT(*) FILTER (WHERE status='in_service')::int AS in_service,
          COUNT(*) FILTER (WHERE status='done')::int AS done
       FROM queues q
       WHERE ($1::text IS NULL OR q.department=$1)`,
      [dept]
    )
    const qv = (queue.rows?.[0] as any) || {}
    rows.push({ section: 'Register - Queue', metric: 'Waiting', value: String(qv.waiting ?? 0) })
    rows.push({ section: 'Register - Queue', metric: 'In Service', value: String(qv.in_service ?? 0) })
    rows.push({ section: 'Register - Queue', metric: 'Done', value: String(qv.done ?? 0) })

    const payments = await query(
      `SELECT COALESCE(SUM(amount),0)::numeric(12,2) AS total_amount, COUNT(*)::int AS count
       FROM payments p
       WHERE p.created_at >= $1 AND p.created_at <= $2`,
      [f.from, f.to]
    )
    const pay = (payments.rows?.[0] as any) || { total_amount: 0, count: 0 }
    rows.push({ section: 'Register - Payments', metric: 'Count', value: String(pay.count ?? 0) })
    rows.push({ section: 'Register - Payments', metric: 'Total Amount', value: String(pay.total_amount ?? 0) })
    // Payments by method
    const byMethod = await query(
      `SELECT method, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::numeric(12,2) AS total
         FROM payments p
        WHERE p.created_at >= $1 AND p.created_at <= $2
        GROUP BY method
        ORDER BY method ASC`,
      [f.from, f.to]
    )
    for (const r of (byMethod.rows as any[])) {
      rows.push({ section: 'Payments by Method', metric: String(r.method), value: String(r.total) })
    }

    // Per-hour arrivals for mini chart
    const perHour = await query(
      `SELECT to_char(date_trunc('hour', created_at), 'YYYY-MM-DD HH24:00') AS hour,
              COUNT(*)::int AS arrivals
         FROM checkins
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY 1
        ORDER BY 1 ASC`,
      [f.from, f.to]
    )
    for (const r of (perHour.rows as any[])) {
      rows.push({ section: 'Arrivals Per Hour', metric: String(r.hour), value: String(r.arrivals) })
    }

    // Dashboard-style KPIs
    const avgWait = await query<{ avg_minutes: string }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (e.created_at - c.created_at)) / 60.0)::numeric(10,2) AS avg_minutes
       FROM queue_events e
       JOIN queues q ON q.id = e.queue_id
       JOIN checkins c ON c.id = q.checkin_id
       WHERE e.to_status = 'in_service'
         AND e.created_at >= $1 AND e.created_at <= $2
         AND ($3::text IS NULL OR q.department = $3)`,
      [f.from, f.to, dept]
    )
    const avgSvc = await query<{ avg_minutes: string }>(
      `WITH done AS (
         SELECT e.queue_id, e.created_at AS done_at
         FROM queue_events e
         JOIN queues q ON q.id = e.queue_id
         WHERE e.to_status = 'done'
           AND e.created_at >= $1 AND e.created_at <= $2
           AND ($3::text IS NULL OR q.department = $3)
       ), svc AS (
         SELECT d.queue_id,
                d.done_at,
                (
                  SELECT e2.created_at FROM queue_events e2
                  WHERE e2.queue_id = d.queue_id AND e2.to_status = 'in_service' AND e2.created_at <= d.done_at
                  ORDER BY e2.created_at DESC LIMIT 1
                ) AS start_at
         FROM done d
       )
       SELECT AVG(EXTRACT(EPOCH FROM (done_at - start_at)) / 60.0)::numeric(10,2) AS avg_minutes
       FROM svc WHERE start_at IS NOT NULL`,
      [f.from, f.to, dept]
    )
    rows.push({ section: 'Dashboard - KPIs', metric: 'Avg Wait (min)', value: String(avgWait.rows?.[0]?.avg_minutes ?? 0) })
    rows.push({ section: 'Dashboard - KPIs', metric: 'Avg In Service (min)', value: String(avgSvc.rows?.[0]?.avg_minutes ?? 0) })

    const arrivals = await query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM checkins WHERE created_at >= $1 AND created_at <= $2`,
      [f.from, f.to]
    )
    const serviced = await query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM queue_events e
       JOIN queues q ON q.id = e.queue_id
       WHERE e.to_status = 'in_service'
         AND e.created_at >= $1 AND e.created_at <= $2
         AND ($3::text IS NULL OR q.department = $3)`,
      [f.from, f.to, dept]
    )
    const completed = await query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM queue_events e
       JOIN queues q ON q.id = e.queue_id
       WHERE e.to_status = 'done'
         AND e.created_at >= $1 AND e.created_at <= $2
         AND ($3::text IS NULL OR q.department = $3)`,
      [f.from, f.to, dept]
    )
    rows.push({ section: 'Dashboard - KPIs', metric: 'Arrivals', value: String(arrivals.rows?.[0]?.count ?? 0) })
    rows.push({ section: 'Dashboard - KPIs', metric: 'Serviced', value: String(serviced.rows?.[0]?.count ?? 0) })
    rows.push({ section: 'Dashboard - KPIs', metric: 'Completed', value: String(completed.rows?.[0]?.count ?? 0) })

    // Per-department breakdown (queue status & KPIs)
    const depts = await query<{ department: string }>(
      `SELECT DISTINCT department FROM queues WHERE department IS NOT NULL ORDER BY department ASC`
    )
    for (const d of (depts.rows as any[])) {
      const dep = d.department
      const dqueue = await query(
        `SELECT COUNT(*) FILTER (WHERE status='waiting')::int AS waiting,
                COUNT(*) FILTER (WHERE status='in_service')::int AS in_service,
                COUNT(*) FILTER (WHERE status='done')::int AS done
           FROM queues WHERE department = $1`,
        [dep]
      )
      const dq = (dqueue.rows?.[0] as any) || { waiting: 0, in_service: 0, done: 0 }
      rows.push({ section: `Department - ${dep}`, metric: 'Waiting', value: String(dq.waiting ?? 0) })
      rows.push({ section: `Department - ${dep}`, metric: 'In Service', value: String(dq.in_service ?? 0) })
      rows.push({ section: `Department - ${dep}`, metric: 'Done', value: String(dq.done ?? 0) })
      const davg = await query(
        `WITH done AS (
           SELECT e.queue_id, e.created_at AS done_at
           FROM queue_events e
           JOIN queues q ON q.id = e.queue_id
           WHERE e.to_status = 'done' AND q.department = $1 AND e.created_at >= $2 AND e.created_at <= $3
         ), svc AS (
           SELECT d.queue_id,
                  d.done_at,
                  (
                    SELECT e2.created_at FROM queue_events e2
                    WHERE e2.queue_id = d.queue_id AND e2.to_status = 'in_service' AND e2.created_at <= d.done_at
                    ORDER BY e2.created_at DESC LIMIT 1
                  ) AS start_at
           FROM done d
         )
         SELECT AVG(EXTRACT(EPOCH FROM (done_at - start_at)) / 60.0)::numeric(10,2) AS avg_svc`,
        [dep, f.from, f.to]
      )
      const dstart = await query(
        `SELECT AVG(EXTRACT(EPOCH FROM (e.created_at - c.created_at)) / 60.0)::numeric(10,2) AS avg_wait
           FROM queue_events e
           JOIN queues q ON q.id = e.queue_id
           JOIN checkins c ON c.id = q.checkin_id
          WHERE e.to_status = 'in_service' AND q.department = $1 AND e.created_at >= $2 AND e.created_at <= $3`,
        [dep, f.from, f.to]
      )
      rows.push({ section: `Department - ${dep}`, metric: 'Avg Wait (min)', value: String((dstart.rows?.[0] as any)?.avg_wait ?? 0) })
      rows.push({ section: `Department - ${dep}`, metric: 'Avg In Service (min)', value: String((davg.rows?.[0] as any)?.avg_svc ?? 0) })
    }

    return { rows, nextCursor: undefined }
  }
}

