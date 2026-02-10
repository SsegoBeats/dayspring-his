-- 0017_doctor_to_clinician_and_schedule_crud.sql
-- Normalize role: treat all Doctor users as Clinician (hospital preference).
-- No schema change to doctor_schedules; PATCH/DELETE are handled in API by id.

UPDATE users SET role = 'Clinician' WHERE role = 'Doctor';
