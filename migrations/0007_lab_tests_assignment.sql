-- Assignment support for radiology / lab tests
-- Adds assignee tracking so cases can be explicitly assigned to a radiologist.

ALTER TABLE IF EXISTS lab_tests
  ADD COLUMN IF NOT EXISTS assigned_radiologist_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_lab_tests_assigned_radiologist ON lab_tests(assigned_radiologist_id);

