WITH latest_arrivals AS (
  SELECT DISTINCT ON (c.patient_id)
    c.id AS checkin_id,
    c.patient_id,
    c.created_at,
    COALESCE(NULLIF(BTRIM(a.department), ''), 'Triage') AS initial_department
  FROM checkins c
  JOIN patients p ON p.id = c.patient_id
  LEFT JOIN appointments a
    ON a.id = c.appointment_id
   AND a.patient_id = c.patient_id
  WHERE c.status = 'Arrived'
    AND p.current_status = 'Registered'
    AND (p.current_location IS NULL OR BTRIM(p.current_location) = '')
  ORDER BY c.patient_id, c.created_at DESC NULLS LAST, c.id DESC
),
inserted_routes AS (
  INSERT INTO patient_routing
    (patient_id, checkin_id, from_department, to_department, reason, priority, status, created_at)
  SELECT
    c.patient_id,
    c.checkin_id,
    'Reception',
    c.initial_department,
    'Initial handoff from legacy check-in migration',
    'Standard',
    'Pending',
    COALESCE(c.created_at, NOW())
  FROM latest_arrivals c
  WHERE NOT EXISTS (
    SELECT 1
    FROM patient_routing r
    WHERE r.patient_id = c.patient_id
      AND r.status IN ('Pending', 'Acknowledged')
  )
    AND NOT EXISTS (
      SELECT 1
      FROM patient_routing r
      WHERE r.checkin_id = c.checkin_id
    )
  RETURNING patient_id, to_department
)
UPDATE patients p
   SET current_location = r.to_department,
       current_status = 'In Progress',
       updated_at = NOW()
  FROM inserted_routes r
 WHERE p.id = r.patient_id;
