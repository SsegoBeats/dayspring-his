CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS organization_settings (
  id INT PRIMARY KEY,
  name VARCHAR(200),
  logo_url TEXT,
  email VARCHAR(200),
  phone VARCHAR(100),
  address TEXT,
  currency VARCHAR(10) NOT NULL DEFAULT 'UGX',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'UGX';

INSERT INTO organization_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'system',
  locale VARCHAR(10) DEFAULT 'en-UG',
  currency VARCHAR(10) DEFAULT 'UGX',
  timezone VARCHAR(100) DEFAULT 'Africa/Kampala',
  notify_email_reminders BOOLEAN DEFAULT true,
  date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  default_dashboard VARCHAR(50) DEFAULT 'overview',
  appointment_alerts BOOLEAN DEFAULT true,
  lab_results BOOLEAN DEFAULT true,
  system_updates BOOLEAN DEFAULT false,
  emergency_alerts BOOLEAN DEFAULT true,
  queue_wait_warn INT DEFAULT 30,
  queue_wait_crit INT DEFAULT 60,
  service_warn INT DEFAULT 30,
  service_crit INT DEFAULT 60,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id)
);

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_dashboard VARCHAR(50) DEFAULT 'overview';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS appointment_alerts BOOLEAN DEFAULT true;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS lab_results BOOLEAN DEFAULT true;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS system_updates BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS emergency_alerts BOOLEAN DEFAULT true;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS queue_wait_warn INT DEFAULT 30;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS queue_wait_crit INT DEFAULT 60;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS service_warn INT DEFAULT 30;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS service_crit INT DEFAULT 60;
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signature TEXT;

ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Routine';
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS specimen_type VARCHAR(100);
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS accession_number VARCHAR(50);
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS collected_at TIMESTAMP;
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES users(id);
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS assigned_radiologist_id UUID REFERENCES users(id);
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_code VARCHAR(20);
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_long_name TEXT;
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_property TEXT;
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_scale TEXT;
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_system TEXT;
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_time_aspct TEXT;
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_class TEXT;
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_units TEXT;
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS result_json JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_lab_tests_ordered ON lab_tests(ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_tests_accession ON lab_tests(accession_number);
CREATE INDEX IF NOT EXISTS idx_lab_tests_assigned_radiologist ON lab_tests(assigned_radiologist_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_loinc ON lab_tests(loinc_code);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  department VARCHAR(100),
  role VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'System',
  priority VARCHAR(20) DEFAULT 'Standard',
  is_read BOOLEAN DEFAULT false,
  related_patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  payload JSONB,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS role VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'System';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Standard';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_patient_id UUID REFERENCES patients(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_dept ON notifications(department, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_user_states (
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id)
);

ALTER TABLE notification_user_states ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;
ALTER TABLE notification_user_states ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE notification_user_states ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE notification_user_states ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_notification_user_states_user ON notification_user_states(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_user_states_notification ON notification_user_states(notification_id);

CREATE TABLE IF NOT EXISTS patient_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patient_deletion_requests_patient ON patient_deletion_requests(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_deletion_requests_status ON patient_deletion_requests(status, created_at DESC);
