# Facility & Ward Multi-site Model

This migration and API scaffold implement a facility/ward model and basic tenant association.

Schema
- `facilities` — represents hospitals/clinics/labs with address/contact/metadata.
- `wards` — physical areas inside a facility (ward, department, unit, theatre).
- `facility_users` — maps `users` to facilities with role and permissions.
- Links: `patients`, `appointments`, `procedures`, `referrals` now have `facility_id`.

Usage
- Create facility: `POST /api/facility` with JSON `{ name, code, type, address }`.
- List facilities: `GET /api/facility`.
- Read facility: `GET /api/facility/:id`.

Next steps
- Replace `lib/facility/model.ts` stubs with real DB queries (pg client or ORM).
- Enforce facility scoping in API endpoints (middleware to restrict by user's facility access).
- Add admin UI for facility and ward management.
- Add automated tests for multi-site isolation and cross-facility access control.
