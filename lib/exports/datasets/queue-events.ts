import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const Filter = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  department: z.string().optional(),
  status: z.enum(['waiting','in_service','done','cancelled']).optional(),
})

export class QueueEventsDataset implements Dataset {
  name = "queue_events"
  defaultColumns = [
    'event_time','from_status','to_status','department','queue_status','patient_number','first_name','last_name'
  ]
  validateFilters(input: any) { return Filter.parse(input) }
  async queryPage(ctx: ExportContext, f: z.infer<typeof Filter>, cursor?: { after?: string }, pageSize = 5000) {
    const after = cursor?.after ?? null
    const { rows } = await query(
      `SELECT e.created_at as event_time,
              e.from_status,
              e.to_status,
              q.department,
              q.status as queue_status,
              p.patient_number,
              p.first_name,
              p.last_name
         FROM queue_events e
         JOIN queues q ON q.id = e.queue_id
         JOIN checkins c ON c.id = q.checkin_id
         JOIN patients p ON p.id = c.patient_id
        WHERE e.created_at >= $1
          AND e.created_at <= $2
          AND ($3::text IS NULL OR q.department = $3)
          AND ($4::text IS NULL OR e.to_status = $4)
          AND ($5::timestamp IS NULL OR e.created_at > $5)
        ORDER BY e.created_at ASC
        LIMIT $6`,
      [f.from, f.to, f.department ?? null, f.status ?? null, after, pageSize]
    )
    const nextCursor = rows.length === pageSize ? { after: rows[rows.length - 1].event_time } : undefined
    return { rows, nextCursor }
  }
}

