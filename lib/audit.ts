import { query } from "@/lib/db"

export const AUDIT_ENTRIES_CTE = `
  WITH audit_entries AS (
    SELECT
      al.id::text AS id,
      al.created_at AS timestamp,
      al.user_id,
      NULL::text AS actor_name,
      al.action,
      al.entity_type,
      al.entity_id,
      al.details,
      al.ip_address
    FROM audit_logs al

    UNION ALL

    SELECT
      'clinical-' || ca.id::text AS id,
      ca.event_at AS timestamp,
      COALESCE(ca.modified_by, ca.recorded_by) AS user_id,
      COALESCE(ca.modified_by_name, ca.recorded_by_name) AS actor_name,
      CASE ca.event_type
        WHEN 'INSERT' THEN 'CREATE'
        ELSE ca.event_type
      END AS action,
      ca.record_table AS entity_type,
      ca.record_id AS entity_id,
      jsonb_build_object(
        'category', 'CLINICAL',
        'description', format(
          '%s clinical record in %s for patient %s',
          CASE ca.event_type
            WHEN 'INSERT' THEN 'Recorded'
            WHEN 'UPDATE' THEN 'Modified'
            ELSE 'Deleted'
          END,
          ca.module,
          COALESCE(ca.patient_id::text, 'unknown')
        ),
        'metadata', jsonb_build_object(
          'patientId', ca.patient_id,
          'module', ca.module,
          'department', ca.department,
          'eventType', ca.event_type,
          'recordedAt', ca.recorded_at,
          'recordedBy', ca.recorded_by,
          'recordedByName', ca.recorded_by_name,
          'modifiedAt', ca.modified_at,
          'modifiedBy', ca.modified_by,
          'modifiedByName', ca.modified_by_name,
          'beforeData', ca.before_data,
          'afterData', ca.after_data
        )
      ) AS details,
      NULL::text AS ip_address
    FROM clinical_audit_trail ca
  )
`

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

