-- 0016_medical_record_vital_signs.sql
-- Link vital_signs to medical_records so consultation vitals are stored and retrieved with the visit.

ALTER TABLE vital_signs
  ADD COLUMN IF NOT EXISTS medical_record_id UUID REFERENCES medical_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vital_signs_medical_record_id ON vital_signs(medical_record_id);
