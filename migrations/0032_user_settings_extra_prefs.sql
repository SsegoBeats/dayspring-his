-- Migration 0032: Add missing user_settings columns
-- Formally migrates columns that were previously only added at runtime by ensurePreferenceColumns().
-- All statements are idempotent (ADD COLUMN IF NOT EXISTS).

-- timezone was in the 0002 CREATE TABLE IF NOT EXISTS but never in an ALTER TABLE,
-- so databases set up via the /api/migrate route would not have it.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Africa/Kampala';

-- extra_prefs: JSONB blob for role-specific preferences (e.g. radiologistWorkflow).
-- Added in the radiology portal session; previously only ensured at runtime.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS extra_prefs JSONB DEFAULT '{}';
