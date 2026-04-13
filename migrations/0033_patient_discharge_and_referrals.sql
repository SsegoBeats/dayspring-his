-- Migration 0033: Patient Discharge Export and Referral System
-- Created for Phase 2 implementation

-- Prescription administrations table for tracking when nurses give medications
CREATE TABLE IF NOT EXISTS prescription_administrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  administered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  administered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dose_given TEXT NOT NULL,
  route TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_prescription_administrations_prescription ON prescription_administrations(prescription_id, administered_at DESC);
CREATE INDEX idx_prescription_administrations_nurse ON prescription_administrations(administered_by);

-- Procedures table for tracking ordered and completed procedures
CREATE TABLE IF NOT EXISTS procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  ordered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  procedure_name TEXT NOT NULL,
  procedure_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'in_progress', 'completed', 'cancelled')),
  ordered_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_procedures_patient ON procedures(patient_id, ordered_at DESC);
CREATE INDEX idx_procedures_status ON procedures(status);

-- Referrals table for internal and external patient referrals
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('internal', 'external-out', 'external-in')),
  referring_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  referring_role TEXT,
  receiving_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  receiving_department TEXT,
  external_facility_name TEXT,
  external_clinician_name TEXT,
  external_clinician_contact TEXT,
  reason TEXT NOT NULL,
  urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('emergency', 'Very Urgent', 'urgent', 'routine', 'low')),
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_referrals_patient ON referrals(patient_id, created_at DESC);
CREATE INDEX idx_referrals_receiving_user ON referrals(receiving_user_id) WHERE type = 'internal';
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_type ON referrals(type);

-- Add trigger for updated_at
CREATE TRIGGER update_procedures_updated_at BEFORE UPDATE ON procedures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add administration_guidance to prescriptions table
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS administration_guidance TEXT;

COMMENT ON TABLE prescription_administrations IS 'Tracks when nurses administer medications to patients';
COMMENT ON TABLE procedures IS 'Medical procedures ordered and completed for patients';
COMMENT ON TABLE referrals IS 'Internal and external patient referrals between departments and facilities';
