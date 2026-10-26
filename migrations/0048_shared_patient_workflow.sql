ALTER TABLE patient_routing
  ADD COLUMN IF NOT EXISTS checkin_id UUID REFERENCES checkins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patient_routing_checkin_id
  ON patient_routing(checkin_id);
