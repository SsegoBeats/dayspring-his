-- Migration 0030: appointment_reminders table
-- Tracks which appointments have had reminder emails sent, preventing duplicates.

CREATE TABLE IF NOT EXISTS appointment_reminders (
  id           UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID    NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  sent_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (appointment_id)
);
