-- Migration: Add notification columns to user_settings table
-- Run this to update the existing user_settings table with new notification preferences

ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signature VARCHAR(255);

ALTER TABLE user_settings 
  ADD COLUMN IF NOT EXISTS appointment_alerts BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS lab_results BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS system_updates BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_alerts BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Africa/Kampala',
  ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  ADD COLUMN IF NOT EXISTS default_dashboard VARCHAR(50) DEFAULT 'overview';
