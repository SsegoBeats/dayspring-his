-- Patient satisfaction feedback for admin dashboard
CREATE TABLE IF NOT EXISTS patient_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  visit_id TEXT,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_feedback_created_at ON patient_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_feedback_patient_id ON patient_feedback(patient_id);
