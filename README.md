# Dayspring Medical Center HIS

A production-grade Next.js (App Router) HIS with secure Postgres backend, RBAC + RLS, email/SMS, background jobs, and PWA.

## Quick start

1) Requirements
- Node 20+
- PostgreSQL 14+

2) Configure environment (.env)
- Database
  - `DATABASE_URL=postgresql://postgres:password@localhost:5432/dayspring_medical_center?schema=public`
- Auth
  - `JWT_SECRET=<strong-random-32+>`
- App
  - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- Email (SMTP/Resend optional)
  - `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` `SMTP_USER` `SMTP_PASS` `SMTP_FROM`
  - `RESEND_API_KEY` (optional)
  - `NOTIFY_TO`
- Logging/Tracing (optional)
  - `SENTRY_DSN`
- SMS (optional)
  - `SMS_PROVIDER=none` (or provider key/config)

3) Install and run
```bash
npm install
npm run dev
```

4) Apply schema
```bash
# With dev server running
curl -s http://localhost:3000/api/migrate
```
This endpoint creates or updates the database schema only; it does not create any default users or sample data.

## Architecture overview

- Next.js App Router + TypeScript
- Postgres via `pg` with:
  - RBAC (app-level) + RLS (database-level)
  - Versioned schema created by `/api/migrate`
- Auth: Cookie-based JWT (HttpOnly; Secure; SameSite=Strict)
- Email: SMTP/Resend via `/api/send-email` (includes email verification flow)
- SMS: `/api/sms/send` (provider-agnostic)
- Jobs: Postgres-backed queue (`jobs`), enqueue `/api/jobs/enqueue`, runner `/api/jobs/run`
- Rate limiting: Postgres (`rate_limits`) used by login/email APIs
- PWA: `public/manifest.webmanifest`, `public/sw.js` registered in layout
- Observability: Sentry (client/server/edge) optional
- OpenAPI: `/api/openapi`

## Security model

- RBAC: centralized in `lib/security.ts` (`can(role, resource, action)`), enforced in route handlers
- RLS: enabled for patients, appointments, bills, medications, medical_records, prescriptions, lab_tests, radiology_tests, notifications
  - Per-request session wiring via `queryWithSession` sets `app.role` / `app.user_id`

## Key endpoints

- Auth: `/api/auth/login|logout|me`
- Patients: `/api/patients`
- Appointments: create `/api/appointments`, list `/api/appointments/list`, slots `/api/appointments/slots`, schedules `/api/doctor-schedules`
- Billing: `/api/billing`
- Medical: `/api/medical`
- Pharmacy meds: `/api/pharmacy/medications`
- Settings: `/api/settings`, `/api/settings/change-email`, `/api/settings/verify-email`
- Email/SMS: `/api/send-email`, `/api/sms/send`
- Jobs: `/api/jobs/enqueue`, `/api/jobs/run`

## Operations

- Migrations: re-run `/api/migrate` after schema changes
- Job runner: call `/api/jobs/run` on a schedule (cron/systemd/PM2)
- Backups: configure periodic DB backups + PITR

## Next steps

- Doctor schedule UI & slot-based booking
- Real SMS provider (MTN/Airtel) + delivery reports
- CI/CD: lint/typecheck/tests; apply migrations on deploy; smoke checks
