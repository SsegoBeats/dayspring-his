-- Ensure core extension and tables/columns used by receptionist portal
-- Safe to run multiple times (IF NOT EXISTS guards)

-- UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Notifications schema compatible with /api/notifications and /api/notifications/stream
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  department VARCHAR(100),
  role VARCHAR(50),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  payload JSONB,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Backfill/ensure columns for legacy installs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='notifications') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='department') THEN
      ALTER TABLE notifications ADD COLUMN department VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='role') THEN
      ALTER TABLE notifications ADD COLUMN role VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='payload') THEN
      ALTER TABLE notifications ADD COLUMN payload JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='read_at') THEN
      ALTER TABLE notifications ADD COLUMN read_at TIMESTAMP;
    END IF;
  END IF;
END$$;

-- Indexes to speed up bell loads and streams
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_dept ON notifications(department, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role, created_at DESC);

-- User preferences used by queue board and exports
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'system',
  locale VARCHAR(10) DEFAULT 'en-UG',
  currency VARCHAR(10) DEFAULT 'UGX',
  timezone VARCHAR(100) DEFAULT 'Africa/Kampala',
  notify_email_reminders BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id)
);

-- SLA thresholds (Queue warnings) added to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS queue_wait_warn INT DEFAULT 30;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS queue_wait_crit INT DEFAULT 60;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS service_warn INT DEFAULT 30;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS service_crit INT DEFAULT 60;
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Doctor schedules (used by slot picker)
CREATE TABLE IF NOT EXISTS doctor_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration INT NOT NULL DEFAULT 15,
  max_patients_per_slot INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_doctor_day ON doctor_schedules(doctor_id, day_of_week);

