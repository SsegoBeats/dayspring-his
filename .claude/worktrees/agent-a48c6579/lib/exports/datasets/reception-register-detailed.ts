import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const Filter = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  department: z.string().optional(),
})

export class ReceptionRegisterDetailedDataset implements Dataset {
  name = "reception_register_detailed"
  defaultColumns = ["section", "subsection", "metric", "value"]

  validateFilters(input: any) { return Filter.parse(input) }

  async queryPage(ctx: ExportContext, f: z.infer<typeof Filter>) {
    const dept = f.department ?? null
    const rows: Array<{ section: string; subsection: string; metric: string; value: string }> = []

    // Per-hour arrivals between from/to
    const perHour = await query(
      `SELECT to_char(date_trunc('hour', created_at), 'YYYY-MM-DD HH24:00') AS hour,
              COUNT(*)::int AS arrivals
       FROM checkins
       WHERE created_at >= $1 AND created_at <= $2
       GROUP BY 1
       ORDER BY 1 ASC`,
      [f.from, f.to]
    )
    for (const r of perHour.rows as any[]) {
      rows.push({ section: 'Check-ins', subsection: 'Per Hour', metric: r.hour, value: String(r.arrivals) })
    }

    // Per-department queue breakdown (waiting/in_service/done)
    const perDept = await query(
      `SELECT department,
              COUNT(*) FILTER (WHERE status='waiting')::int AS waiting,
              COUNT(*) FILTER (WHERE status='in_service')::int AS in_service,
              COUNT(*) FILTER (WHERE status='done')::int AS done
         FROM queues
        WHERE ($1::text IS NULL OR department=$1)
        GROUP BY department
        ORDER BY department ASC`,
      [dept]
    )
    for (const r of perDept.rows as any[]) {
      rows.push({ section: 'Queue', subsection: r.department || 'N/A', metric: 'Waiting', value: String(r.waiting) })
      rows.push({ section: 'Queue', subsection: r.department || 'N/A', metric: 'In Service', value: String(r.in_service) })
      rows.push({ section: 'Queue', subsection: r.department || 'N/A', metric: 'Done', value: String(r.done) })
    }

    // Payments by method
    const payByMethod = await query(
      `SELECT method, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::numeric(12,2) AS total
         FROM payments
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY method
        ORDER BY method ASC`,
      [f.from, f.to]
    )
    for (const r of payByMethod.rows as any[]) {
      rows.push({ section: 'Payments', subsection: r.method, metric: 'Count', value: String(r.count) })
      rows.push({ section: 'Payments', subsection: r.method, metric: 'Total Amount', value: String(r.total) })
    }

    return { rows, nextCursor: undefined }
  }
}

