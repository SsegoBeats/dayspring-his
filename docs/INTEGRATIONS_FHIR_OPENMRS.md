# FHIR & OpenMRS Integration

This document describes the minimal FHIR and OpenMRS integration scaffolds added.

Files added:
- `app/api/integrations/fhir/route.ts` - POST a `{ patient }` payload which is mapped and pushed as a FHIR `Patient` resource.
- `lib/interop/fhir.ts` - helper mapping for `Patient` and `pushResource()`.
- `app/api/integrations/openmrs/route.ts` - POST a `{ person }` payload which is mapped and pushed to OpenMRS `ws/rest/v1/person`.
- `lib/interop/openmrs.ts` - helper mapping and push function.

Environment variables:
- `FHIR_BASE_URL`, `FHIR_BEARER_TOKEN` (optional)
- `OPENMRS_BASE_URL`, `OPENMRS_USERNAME`, `OPENMRS_PASSWORD`

Example FHIR POST:

```json
{ "patient": { "firstName": "Jane", "lastName": "Doe", "dob": "1990-01-01", "sex": "female" } }
```

Example OpenMRS POST:

```json
{ "person": { "firstName": "Jane", "lastName": "Doe", "dob": "1990-01-01", "sex": "F" } }
```

Next steps:
- Add mapping tables for data elements and concept IDs.
- Add unit and integration tests under `tests/integrations`.
- Secure routes with existing auth and facility scoping middleware.
