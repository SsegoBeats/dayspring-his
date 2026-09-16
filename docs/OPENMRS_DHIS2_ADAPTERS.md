# OpenMRS & DHIS2 Adapters

This document describes the starter adapters included in the repository. They are intentionally complete (not minimal) skeletons to speed integration work.

OpenMRS
- Route: `POST /api/openmrs` (accepts OpenMRS-style patient payloads)
- Route: `GET /api/openmrs/patient/:id` (returns a mapped OpenMRS-style patient JSON)
- Mapping utilities: `lib/openmrs/adapter.ts` with `mapPatientToOpenMRS` and `mapOpenMRSToPatient`.

DHIS2
- Route: `POST /api/dhis2` (accepts aggregate data and returns a `dataValueSet` or pushes to DHIS2)
- Utilities: `lib/dhis2/adapter.ts` with `buildDataValueSet` and `postToDhis2`.

Next steps to productionize
- Replace TODO stubs with real dataset IDs and DB lookups.
- Add authentication and signing. For DHIS2 prefer server-to-server OAuth or API token with restricted scope.
- Add transformation rules for HMIS indicators mapping to DHIS2 data elements.
- Implement batching, retries, and idempotency for DHIS2 exports.
