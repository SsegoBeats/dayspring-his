# FHIR Integration

This module provides a starting, full-featured FHIR R4 adapter surface.

Implemented endpoints (server):

- `GET /api/fhir/metadata` — returns a `CapabilityStatement` describing supported resources.
- `GET /api/fhir/Patient/:id` — map local patient to FHIR `Patient` (stubbed lookup).
- `POST /api/fhir/Patient` — basic receive endpoint (should validate and upsert into DB).
- `POST /api/fhir/Observation` — accept observation resource and persist.

Next steps to productionize:

- Add validation (use a FHIR validator library) and strict schema checks.
- Implement DB lookup and upsert mapping for `Patient` and `Observation`.
- Add authentication (OAuth2 / SMART on FHIR) and RBAC.
- Add logging, audit, and idempotency (e.g., handle client-assigned IDs).
