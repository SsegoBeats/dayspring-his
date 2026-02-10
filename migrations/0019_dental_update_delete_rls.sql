-- 0019_dental_update_delete_rls.sql
-- Allow Dentist/Doctor to update and delete their own dental records; Admin can do any.

BEGIN;

-- Update: recording dentist (or Doctor) can update own record; Hospital Admin can update any
DROP POLICY IF EXISTS dental_update ON dental_records;
CREATE POLICY dental_update ON dental_records
  FOR UPDATE
  USING (
    current_setting('app.role', true) IN ('Hospital Admin', 'Doctor', 'Dentist')
  )
  WITH CHECK (
    current_setting('app.role', true) = 'Hospital Admin'
    OR dentist_id::text = current_setting('app.user_id', true)
  );

-- Delete: same as update – recording dentist or Admin
DROP POLICY IF EXISTS dental_delete ON dental_records;
CREATE POLICY dental_delete ON dental_records
  FOR DELETE
  USING (
    current_setting('app.role', true) = 'Hospital Admin'
    OR dentist_id::text = current_setting('app.user_id', true)
  );

COMMIT;
