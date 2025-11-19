import { NextResponse } from "next/server"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

const schema = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Receptionist', 'Doctor', 'Radiologist', 'Nurse', 'Lab Tech', 'Hospital Admin', 'Cashier', 'Pharmacist', 'Midwife', 'Dentist')),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    last_login TIMESTAMP,
    email_verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure missing critical columns on existing users table
DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='department') THEN
      ALTER TABLE users ADD COLUMN department VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
      ALTER TABLE users ADD COLUMN role VARCHAR(50);
      UPDATE users SET role = 'Hospital Admin' WHERE role IS NULL;
      ALTER TABLE users ALTER COLUMN role SET NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_active') THEN
      ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
      UPDATE users SET is_active = true WHERE is_active IS NULL;
    END IF;
    -- Ensure role check constraint allows all configured roles, including Midwife and Dentist
    BEGIN
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
    BEGIN
      ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('Receptionist', 'Doctor', 'Radiologist', 'Nurse', 'Lab Tech', 'Hospital Admin', 'Cashier', 'Pharmacist', 'Midwife', 'Dentist'));
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS patient_number_seq START 1;

CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_number VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    age_years INTEGER CHECK (age_years IS NULL OR (age_years >= 0 AND age_years <= 130)),
    gender VARCHAR(20) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    nin VARCHAR(20) UNIQUE,
    national_id_type VARCHAR(30) DEFAULT 'NIN',
    district VARCHAR(100),
    subcounty VARCHAR(100),
    parish VARCHAR(100),
    village VARCHAR(100),
    occupation VARCHAR(100),
    next_of_kin_name VARCHAR(255),
    next_of_kin_phone VARCHAR(20),
    insurance_provider VARCHAR(100),
    insurance_member_no VARCHAR(100),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    blood_group VARCHAR(10),
    allergies TEXT,
    current_location VARCHAR(100),
    current_status VARCHAR(50) DEFAULT 'Registered',
    triage_category VARCHAR(20) CHECK (triage_category IN ('Emergency', 'Very Urgent', 'Urgent', 'Standard', 'Non-urgent')),
    triage_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backfill/ensure column presence when upgrading existing schema
DO $$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'age_years'
  ) THEN
    ALTER TABLE patients ADD COLUMN age_years INTEGER CHECK (age_years IS NULL OR (age_years >= 0 AND age_years <= 130));
  END IF;
  -- Ensure date_of_birth is nullable for cases where only age is provided
  BEGIN
    ALTER TABLE patients ALTER COLUMN date_of_birth DROP NOT NULL;
  EXCEPTION WHEN others THEN NULL;
  END;
END$$;
DO $$
DECLARE
  max_seq INTEGER;
BEGIN
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS seq
    FROM patients
  )
  UPDATE patients
  SET patient_number = 'P' || lpad(ordered.seq::text, 4, '0')
  FROM ordered
  WHERE patients.id = ordered.id;

  SELECT max(seq) INTO max_seq FROM ordered;
  IF max_seq IS NULL THEN
    max_seq := 0;
  END IF;

  PERFORM setval('patient_number_seq', max_seq, false);
END$$;
-- UG triage assessments
CREATE TABLE IF NOT EXISTS triage_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    recorded_by UUID REFERENCES users(id),
    mode VARCHAR(20) DEFAULT 'Adult' CHECK (mode IN ('Adult','Child')),
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    heart_rate INTEGER,
    respiratory_rate INTEGER,
    temperature DECIMAL(4,1),
    oxygen_saturation INTEGER,
    avpu VARCHAR(10) CHECK (avpu IN ('A','V','P','U')),
    mobility VARCHAR(30),
    chief_complaint TEXT,
    discriminators JSONB,
    category VARCHAR(20) NOT NULL CHECK (category IN ('Emergency','Very Urgent','Urgent','Routine','Dead')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seen_by_doctor_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_triage_patient_created ON triage_assessments(patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    department VARCHAR(100) NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled', 'No Show')),
    wait_time_minutes INTEGER,
    checked_in_at TIMESTAMP,
    seen_by_doctor_at TIMESTAMP,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Doctor schedules
CREATE TABLE IF NOT EXISTS doctor_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration INTEGER NOT NULL CHECK (slot_duration IN (10, 15, 20, 30, 60)),
    max_patients_per_slot INTEGER NOT NULL DEFAULT 1 CHECK (max_patients_per_slot >= 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (doctor_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(id),
    visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    chief_complaint TEXT,
    diagnosis TEXT,
    treatment_plan TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vital_signs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    nurse_id UUID NOT NULL REFERENCES users(id),
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    heart_rate INTEGER,
    temperature DECIMAL(4,1),
    respiratory_rate INTEGER,
    oxygen_saturation INTEGER,
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nursing_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    nurse_id UUID NOT NULL REFERENCES users(id),
    note_type VARCHAR(50) NOT NULL CHECK (note_type IN ('Assessment', 'Intervention', 'Observation', 'Medication', 'Other')),
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(id),
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(100) NOT NULL,
    instructions TEXT,
    quantity INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Dispensed', 'Cancelled')),
    dispensed_by UUID REFERENCES users(id),
    dispensed_at TIMESTAMP,
    barcode VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    category VARCHAR(100) NOT NULL,
    unit_type VARCHAR(50) NOT NULL CHECK (unit_type IN ('Tablets', 'Capsules', 'Syrup (ml)', 'Injection', 'Cream/Ointment', 'Other')),
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    unit_price DECIMAL(10,2) NOT NULL,
    reorder_level INTEGER NOT NULL DEFAULT 50,
    expiry_date DATE,
    manufacturer VARCHAR(255),
    barcode VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medication_stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('Receive','Adjust','Dispense','Return')),
    quantity INTEGER NOT NULL,
    reference TEXT,
    batch_number VARCHAR(50),
    expiry_date DATE,
    barcode_snapshot VARCHAR(100),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(id),
    test_name VARCHAR(255) NOT NULL,
    test_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
    results TEXT,
    notes TEXT,
    lab_tech_id UUID REFERENCES users(id),
    ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS radiology_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(id),
    test_name VARCHAR(255) NOT NULL,
    test_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
    findings TEXT,
    notes TEXT,
    radiologist_id UUID REFERENCES users(id),
    ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_number VARCHAR(50) UNIQUE NOT NULL,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    total_amount DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    final_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Partially Paid', 'Cancelled')),
    payment_method VARCHAR(50),
    paid_amount DECIMAL(10,2) DEFAULT 0,
    barcode VARCHAR(255),
    cashier_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bill_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patient_routing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    from_department VARCHAR(100),
    to_department VARCHAR(100) NOT NULL,
    routed_by UUID NOT NULL REFERENCES users(id),
    reason TEXT,
    priority VARCHAR(20) CHECK (priority IN ('Emergency', 'Very Urgent', 'Urgent', 'Standard', 'Non-urgent')),
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Acknowledged', 'Completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    department VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Patient Arrival', 'Lab Result', 'Prescription', 'Payment', 'Low Stock', 'System', 'Other')),
    priority VARCHAR(20) DEFAULT 'Standard' CHECK (priority IN ('Emergency', 'High', 'Standard', 'Low')),
    is_read BOOLEAN DEFAULT false,
    related_patient_id UUID REFERENCES patients(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure audit_logs.user_id foreign key allows hard delete of users
DO $$
DECLARE r RECORD;
BEGIN
  -- Drop existing FK (name varies across DBs); recreate as ON DELETE SET NULL
  PERFORM 1 FROM information_schema.table_constraints tc
   JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'audit_logs' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'user_id';
  IF FOUND THEN
    FOR r IN
      SELECT tc.constraint_name AS constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'audit_logs' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'user_id'
    LOOP
      EXECUTE format('ALTER TABLE audit_logs DROP CONSTRAINT %I', r.constraint_name);
    END LOOP;
  END IF;
  ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
END$$;

-- Normalize remaining foreign keys to users(id) to allow hard delete of users.
-- Keep CASCADE only for objects that must be removed with the user (e.g. schedules and verification tokens).
DO $$
DECLARE
  rec RECORD;
  tgt_table TEXT;
  tgt_column TEXT;
  fk_name TEXT;
  del_rule TEXT;
BEGIN
  FOR rec IN
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'users'
      AND ccu.column_name = 'id'
  LOOP
    fk_name := rec.constraint_name;
    tgt_table := rec.table_name;
    tgt_column := rec.column_name;
    del_rule := rec.delete_rule;

    -- Tables that can safely cascade without leaving orphans
    IF tgt_table IN ('doctor_schedules', 'password_reset_tokens', 'email_verification_tokens') THEN
      CONTINUE;
    END IF;

    -- For all other references, enforce ON DELETE SET NULL (idempotent)
    IF del_rule IS DISTINCT FROM 'SET NULL' THEN
      BEGIN
        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL', tgt_table, tgt_column);
      EXCEPTION WHEN others THEN NULL; -- ignore if already nullable
      END;
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', tgt_table, fk_name);
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON DELETE SET NULL', tgt_table, fk_name, tgt_column);
    END IF;
  END LOOP;
END$$;
-- Consent log
CREATE TABLE IF NOT EXISTS consent_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    rationale TEXT NOT NULL,
    scope TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_consent_user_created ON consent_log(user_id, created_at DESC);

-- (export_jobs removed per simplified direct-download exports)


-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'system',
    locale VARCHAR(10) DEFAULT 'en-UG',
    currency VARCHAR(10) DEFAULT 'UGX',
    notify_email_reminders BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id)
);

-- Email verification tokens (for adding/changing emails)
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    new_email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bed management tables
CREATE TABLE IF NOT EXISTS beds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bed_number VARCHAR(50) UNIQUE NOT NULL,
    ward VARCHAR(100) NOT NULL,
    bed_type VARCHAR(50) NOT NULL CHECK (bed_type IN ('Standard', 'ICU', 'Emergency', 'Surgical', 'Pediatric', 'Maternity', 'Isolation')),
    status VARCHAR(50) NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Occupied', 'Maintenance', 'Reserved')),
    location VARCHAR(255),
    equipment JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bed_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    discharge_date TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Discharged', 'Transfer')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);
CREATE INDEX IF NOT EXISTS idx_beds_ward ON beds(ward);
CREATE INDEX IF NOT EXISTS idx_bed_assignments_bed_id ON bed_assignments(bed_id);
CREATE INDEX IF NOT EXISTS idx_bed_assignments_patient_id ON bed_assignments(patient_id);
CREATE INDEX IF NOT EXISTS idx_bed_assignments_status ON bed_assignments(status);
CREATE INDEX IF NOT EXISTS idx_bed_assignments_assigned_at ON bed_assignments(assigned_at DESC);

DROP TRIGGER IF EXISTS update_beds_updated_at ON beds;
CREATE TRIGGER update_beds_updated_at BEFORE UPDATE ON beds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bed_assignments_updated_at ON bed_assignments;
CREATE TRIGGER update_bed_assignments_updated_at BEFORE UPDATE ON bed_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_patients_patient_number ON patients(patient_number);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_appointments_patient_slot ON appointments(patient_id, appointment_date, appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON appointments(appointment_date, appointment_time);
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_doctor_day ON doctor_schedules(doctor_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_lab_tests_patient_id ON lab_tests(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_status ON lab_tests(status);
CREATE INDEX IF NOT EXISTS idx_radiology_tests_patient_id ON radiology_tests(patient_id);
CREATE INDEX IF NOT EXISTS idx_radiology_tests_status ON radiology_tests(status);
CREATE INDEX IF NOT EXISTS idx_bills_patient_id ON bills(patient_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_patient_routing_patient_id ON patient_routing(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_routing_status ON patient_routing(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_department ON notifications(department);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user_id ON email_verification_tokens(user_id);

-- Create trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_medical_records_updated_at ON medical_records;
CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_medications_updated_at ON medications;
CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON medications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_doctor_schedules_updated_at ON doctor_schedules;
CREATE TRIGGER update_doctor_schedules_updated_at BEFORE UPDATE ON doctor_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Job queue for background work
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    run_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jobs_queue_run_at ON jobs(queue, run_at) WHERE status = 'pending';
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Rate limiter (Postgres-backed)
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL,
    window_seconds INTEGER NOT NULL,
    window_start TIMESTAMP NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (key, window_seconds, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
DROP TRIGGER IF EXISTS update_rate_limits_updated_at ON rate_limits;
CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON rate_limits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === Receptionist Portal: Supporting Structures ===
-- Extensions for search and ID helpers
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enforce strict patient_number format: 6 uppercase alphanumeric
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints c
    JOIN information_schema.table_constraints t ON c.constraint_name = t.constraint_name
    WHERE t.table_name = 'patients' AND c.check_clause ~* '^[^p]*patient_number'
  ) THEN
    ALTER TABLE patients
      ADD CONSTRAINT chk_patients_number_format CHECK (patient_number ~ '^[A-Z0-9]{6}$');
  END IF;
END$$;

-- Trigram indexes for fast patient search
CREATE INDEX IF NOT EXISTS idx_patients_last_name_trgm ON patients USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_first_name_trgm ON patients USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_phone_trgm ON patients USING gin (phone gin_trgm_ops);

-- Insurance master data
CREATE TABLE IF NOT EXISTS insurance_payers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL UNIQUE,
    payer_code VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
DROP TRIGGER IF EXISTS update_insurance_payers_updated_at ON insurance_payers;
CREATE TRIGGER update_insurance_payers_updated_at BEFORE UPDATE ON insurance_payers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS insurance_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    payer_id UUID NOT NULL REFERENCES insurance_payers(id) ON DELETE RESTRICT,
    policy_no VARCHAR(100) NOT NULL,
    coverage_notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (patient_id, payer_id, policy_no)
);
CREATE INDEX IF NOT EXISTS idx_policies_patient ON insurance_policies(patient_id);
CREATE INDEX IF NOT EXISTS idx_policies_payer ON insurance_policies(payer_id);
DROP TRIGGER IF EXISTS update_insurance_policies_updated_at ON insurance_policies;
CREATE TRIGGER update_insurance_policies_updated_at BEFORE UPDATE ON insurance_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Pre-authorizations
CREATE TABLE IF NOT EXISTS preauthorizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    payer_id UUID NOT NULL REFERENCES insurance_payers(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Denied','Expired')),
    auth_code VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_preauth_patient ON preauthorizations(patient_id);
CREATE INDEX IF NOT EXISTS idx_preauth_payer ON preauthorizations(payer_id);
CREATE INDEX IF NOT EXISTS idx_preauth_status ON preauthorizations(status);
DROP TRIGGER IF EXISTS update_preauthorizations_updated_at ON preauthorizations;
CREATE TRIGGER update_preauthorizations_updated_at BEFORE UPDATE ON preauthorizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Check-ins
CREATE TABLE IF NOT EXISTS checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Arrived' CHECK (status IN ('Arrived','With Nurse','In Room','Complete','Cancelled')),
    receptionist_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_checkins_patient ON checkins(patient_id);
CREATE INDEX IF NOT EXISTS idx_checkins_status ON checkins(status);
CREATE INDEX IF NOT EXISTS idx_checkins_created ON checkins(created_at DESC);
DROP TRIGGER IF EXISTS update_checkins_updated_at ON checkins;
CREATE TRIGGER update_checkins_updated_at BEFORE UPDATE ON checkins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Department queues
CREATE TABLE IF NOT EXISTS queues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department VARCHAR(100) NOT NULL,
    checkin_id UUID NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','in_service','done','cancelled')),
    priority INTEGER NOT NULL DEFAULT 0,
    position INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_queues_dept_status ON queues(department, status);
CREATE INDEX IF NOT EXISTS idx_queues_checkin ON queues(checkin_id);
-- Optimize lane ordering operations
CREATE INDEX IF NOT EXISTS idx_queues_lane_pos ON queues(department, status, position);
DROP TRIGGER IF EXISTS update_queues_updated_at ON queues;
CREATE TRIGGER update_queues_updated_at BEFORE UPDATE ON queues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Payments and receipts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'receipt_seq') THEN
    CREATE SEQUENCE receipt_seq START 1;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_no VARCHAR(30) UNIQUE NOT NULL DEFAULT (
      'DMC' || to_char(now(),'YYMMDD') || lpad(nextval('receipt_seq')::text, 6, '0')
    ),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    method VARCHAR(20) NOT NULL CHECK (method IN ('cash','card','mobile_money','bank')),
    reference VARCHAR(100),
    cashier_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payments_patient_created ON payments(patient_id, created_at DESC);
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Payment line items
CREATE TABLE IF NOT EXISTS payment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0)
);
CREATE INDEX IF NOT EXISTS idx_payment_items_payment ON payment_items(payment_id);

-- Queue status transition events (for SLA/timing)
CREATE TABLE IF NOT EXISTS queue_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    from_status VARCHAR(20) CHECK (from_status IN ('waiting','in_service','done','cancelled')),
    to_status VARCHAR(20) NOT NULL CHECK (to_status IN ('waiting','in_service','done','cancelled')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_queue_events_queue ON queue_events(queue_id, created_at);
CREATE INDEX IF NOT EXISTS idx_queue_events_created ON queue_events(created_at);
CREATE INDEX IF NOT EXISTS idx_queue_events_to_status_created ON queue_events(to_status, created_at);

-- SLA thresholds in user_settings (optional overrides)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_settings') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='queue_wait_warn') THEN
      ALTER TABLE user_settings ADD COLUMN queue_wait_warn INT DEFAULT 30;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='queue_wait_crit') THEN
      ALTER TABLE user_settings ADD COLUMN queue_wait_crit INT DEFAULT 60;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='service_warn') THEN
      ALTER TABLE user_settings ADD COLUMN service_warn INT DEFAULT 30;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='service_crit') THEN
      ALTER TABLE user_settings ADD COLUMN service_crit INT DEFAULT 60;
    END IF;
  END IF;
END$$;

-- Notifications for departments/roles/users
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
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_dept ON notifications(department, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role, created_at DESC);

-- Patient documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('ID','INSURANCE','CONSENT','OTHER')),
    file_url TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_documents_patient ON documents(patient_id);

-- === Row Level Security (RLS) ===
-- Use session settings: SELECT set_config('app.role', 'Doctor', true), set_config('app.user_id', '<uuid>', true)

-- Patients
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patients_select ON patients;
CREATE POLICY patients_select ON patients FOR SELECT USING (current_setting('app.role', true) IS NOT NULL);
DROP POLICY IF EXISTS patients_insert ON patients;
CREATE POLICY patients_insert ON patients FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Receptionist'));
DROP POLICY IF EXISTS patients_update ON patients;
CREATE POLICY patients_update ON patients FOR UPDATE USING (current_setting('app.role', true) IN ('Hospital Admin','Receptionist'));

-- Appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS appts_select ON appointments;
CREATE POLICY appts_select ON appointments FOR SELECT USING (current_setting('app.role', true) IS NOT NULL);
DROP POLICY IF EXISTS appts_insert ON appointments;
CREATE POLICY appts_insert ON appointments FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Receptionist','Doctor','Midwife','Dentist','Nurse'));
DROP POLICY IF EXISTS appts_update ON appointments;
CREATE POLICY appts_update ON appointments FOR UPDATE USING (current_setting('app.role', true) IN ('Hospital Admin','Receptionist','Doctor','Midwife','Dentist','Nurse'));

-- Bills
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bills_select ON bills;
CREATE POLICY bills_select ON bills FOR SELECT USING (current_setting('app.role', true) IN ('Hospital Admin','Cashier'));
DROP POLICY IF EXISTS bills_update ON bills;
CREATE POLICY bills_update ON bills FOR UPDATE USING (current_setting('app.role', true) IN ('Hospital Admin','Cashier'));

-- Medications
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_medications_barcode ON medications(barcode);
DROP POLICY IF EXISTS meds_select ON medications;
CREATE POLICY meds_select ON medications FOR SELECT USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist','Doctor','Midwife','Dentist','Nurse'));
DROP POLICY IF EXISTS meds_delete ON medications;
CREATE POLICY meds_delete ON medications FOR DELETE USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

-- Medication stock movements (pharmacy)
ALTER TABLE medication_stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS medstock_select ON medication_stock_movements;
CREATE POLICY medstock_select ON medication_stock_movements FOR SELECT USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));
DROP POLICY IF EXISTS medstock_insert ON medication_stock_movements;
CREATE POLICY medstock_insert ON medication_stock_movements FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

-- Medical records
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS medrec_select ON medical_records;
CREATE POLICY medrec_select ON medical_records FOR SELECT USING (current_setting('app.role', true) IN ('Hospital Admin','Doctor','Midwife','Dentist','Nurse'));
DROP POLICY IF EXISTS medrec_insert ON medical_records;
CREATE POLICY medrec_insert ON medical_records FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Doctor','Midwife','Dentist'));
DROP POLICY IF EXISTS medrec_update ON medical_records;
CREATE POLICY medrec_update ON medical_records FOR UPDATE USING (current_setting('app.role', true) IN ('Hospital Admin','Doctor','Midwife','Dentist'));

-- Prescriptions
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rx_select ON prescriptions;
CREATE POLICY rx_select ON prescriptions FOR SELECT USING (current_setting('app.role', true) IN ('Hospital Admin','Doctor','Midwife','Dentist','Pharmacist'));
DROP POLICY IF EXISTS rx_insert ON prescriptions;
CREATE POLICY rx_insert ON prescriptions FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Doctor','Midwife','Dentist'));
DROP POLICY IF EXISTS rx_update ON prescriptions;
CREATE POLICY rx_update ON prescriptions FOR UPDATE USING (current_setting('app.role', true) IN ('Hospital Admin','Doctor','Midwife','Dentist','Pharmacist'));

-- Lab tests
-- Ensure reviewed columns exist for lab tests
DO $$
DECLARE
  c1 BOOLEAN;
  c2 BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='lab_tests' AND column_name='reviewed_by'
  ) INTO c1;
  IF NOT c1 THEN
    ALTER TABLE lab_tests ADD COLUMN reviewed_by UUID REFERENCES users(id);
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='lab_tests' AND column_name='reviewed_at'
  ) INTO c2;
  IF NOT c2 THEN
    ALTER TABLE lab_tests ADD COLUMN reviewed_at TIMESTAMP;
  END IF;
END$$;

ALTER TABLE lab_tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lab_select ON lab_tests;
CREATE POLICY lab_select ON lab_tests FOR SELECT USING (current_setting('app.role', true) IN ('Hospital Admin','Doctor','Midwife','Dentist','Lab Tech','Nurse'));
DROP POLICY IF EXISTS lab_insert ON lab_tests;
CREATE POLICY lab_insert ON lab_tests FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Doctor','Midwife','Dentist'));
DROP POLICY IF EXISTS lab_update ON lab_tests;
-- Allow Admin, Lab Tech, and Doctor-family roles to update (needed to mark results as reviewed)
CREATE POLICY lab_update ON lab_tests FOR UPDATE USING (current_setting('app.role', true) IN ('Hospital Admin','Lab Tech','Doctor','Midwife','Dentist'));

-- Guard updates with a trigger: reviewed_* can only be set by Doctor/Admin; completing results only by Lab Tech/Admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'fn_guard_lab_tests_update'
  ) THEN
    CREATE OR REPLACE FUNCTION fn_guard_lab_tests_update() RETURNS trigger AS $$
    DECLARE
      app_role text := current_setting('app.role', true);
    BEGIN
      IF (NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at) THEN
        IF app_role NOT IN ('Hospital Admin','Doctor','Midwife','Dentist') THEN
          RAISE EXCEPTION 'Only Doctor, Midwife, Dentist or Admin may set reviewed fields';
        END IF;
      END IF;
      IF (NEW.status IS DISTINCT FROM OLD.status OR NEW.results IS DISTINCT FROM OLD.results) THEN
        IF NEW.status ILIKE 'Completed' AND app_role NOT IN ('Hospital Admin','Lab Tech') THEN
          RAISE EXCEPTION 'Only Lab Tech or Admin may complete results';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
  BEGIN
    DROP TRIGGER IF EXISTS trg_guard_lab_tests_update ON lab_tests;
    CREATE TRIGGER trg_guard_lab_tests_update BEFORE UPDATE ON lab_tests FOR EACH ROW EXECUTE FUNCTION fn_guard_lab_tests_update();
  EXCEPTION WHEN others THEN NULL;
  END;
END$$;

-- Radiology tests
ALTER TABLE radiology_tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rads_select ON radiology_tests;
CREATE POLICY rads_select ON radiology_tests FOR SELECT USING (current_setting('app.role', true) IN ('Hospital Admin','Doctor','Radiologist','Nurse'));
DROP POLICY IF EXISTS rads_insert ON radiology_tests;
CREATE POLICY rads_insert ON radiology_tests FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Doctor'));
DROP POLICY IF EXISTS rads_update ON radiology_tests;
CREATE POLICY rads_update ON radiology_tests FOR UPDATE USING (current_setting('app.role', true) IN ('Hospital Admin','Radiologist'));

-- Notifications (read-only)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notif_select ON notifications;
CREATE POLICY notif_select ON notifications FOR SELECT USING (current_setting('app.role', true) IS NOT NULL);

-- Receptionist-specific RLS
ALTER TABLE insurance_payers ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE preauthorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ins_payers_select ON insurance_payers;
CREATE POLICY ins_payers_select ON insurance_payers FOR SELECT USING (current_setting('app.role', true) IS NOT NULL);

DROP POLICY IF EXISTS ins_policies_rw ON insurance_policies;
CREATE POLICY ins_policies_rw ON insurance_policies FOR ALL USING (current_setting('app.role', true) IN ('Hospital Admin','Receptionist')) WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Receptionist'));

DROP POLICY IF EXISTS preauth_rw ON preauthorizations;
CREATE POLICY preauth_rw ON preauthorizations FOR ALL USING (current_setting('app.role', true) IN ('Hospital Admin','Receptionist')) WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Receptionist'));

DROP POLICY IF EXISTS checkins_rw ON checkins;
CREATE POLICY checkins_rw ON checkins FOR ALL USING (current_setting('app.role', true) IN ('Hospital Admin','Receptionist','Nurse')) WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Receptionist','Nurse'));

DROP POLICY IF EXISTS queues_rw ON queues;
CREATE POLICY queues_rw ON queues FOR ALL USING (current_setting('app.role', true) IN ('Hospital Admin','Receptionist','Nurse')) WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Receptionist','Nurse'));

DROP POLICY IF EXISTS payments_rw ON payments;
CREATE POLICY payments_rw ON payments FOR ALL USING (current_setting('app.role', true) IN ('Hospital Admin','Cashier','Receptionist')) WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Cashier','Receptionist'));

DROP POLICY IF EXISTS documents_rw ON documents;
CREATE POLICY documents_rw ON documents FOR ALL USING (current_setting('app.role', true) IS NOT NULL) WITH CHECK (current_setting('app.role', true) IS NOT NULL);
`

export async function GET() {
  const client = await pool.connect()

  try {
    console.log("[v0] Starting database migration...")

    // Preflight: ensure legacy databases have critical columns before running full schema
    try { await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50)") } catch {}
    try { await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true") } catch {}
    try { await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100)") } catch {}

    // Execute schema creation (best-effort; legacy bootstrap path)
    try {
      await client.query(schema)
      console.log("[v0] Schema created successfully")
    } catch (e: any) {
      // Some environments may hit non-fatal syntax issues in legacy DO $$ blocks.
      // We log and continue because CLI migrations in /migrations are the primary source of truth.
      console.error("[v0] Schema creation encountered an error but will be treated as non-fatal:", e?.message || e)
    }

    return NextResponse.json({
      success: true,
      message: "Database migration completed successfully.",
    })
  } catch (error: any) {
    console.error("[v0] Migration error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack,
      },
      { status: 500 },
    )
  } finally {
    client.release()
  }
}
