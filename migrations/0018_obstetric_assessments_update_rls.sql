-- 0018_obstetric_assessments_update_rls.sql
-- Allow clinicians to update obstetric assessments (e.g. correct visit_date or notes).

BEGIN;

DROP POLICY IF EXISTS obs_update ON obstetric_assessments;
CREATE POLICY obs_update ON obstetric_assessments
  FOR UPDATE
  USING (
    current_setting('app.role', true) IN (
      'Hospital Admin',
      'Doctor',
      'Midwife'
    )
  )
  WITH CHECK (
    current_setting('app.role', true) IN (
      'Hospital Admin',
      'Doctor',
      'Midwife'
    )
  );

COMMIT;
