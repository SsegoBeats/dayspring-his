import { query } from "@/lib/db"

export async function writeAuditLog(params: {
  userId?: string
  action: string
  entityType: string
  entityId?: string
  details?: any
  ip?: string
}) {
  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [params.userId || null, params.action, params.entityType, params.entityId || null, params.details || null, params.ip || null],
  )
}


