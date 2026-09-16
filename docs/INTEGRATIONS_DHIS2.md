# DHIS2 Integration

This document describes the minimal DHIS2 integration scaffold added to the repo.

Files added:
- `app/api/integrations/dhis2/route.ts` - server route accepting POST payloads `{ period, orgUnit, dataValues[] }` and forwarding to DHIS2.
- `lib/interop/dhis2.ts` - helper functions: `buildDataValueSet()` and `pushDataValueSet()`.

Environment variables:
- `DHIS2_BASE_URL` - e.g. `https://play.dhis2.org/2.36.3`
- `DHIS2_USERNAME` and `DHIS2_PASSWORD` - optional; if provided, HTTP Basic Auth is used.

Example POST payload:

```json
{
  "period": "202608",
  "orgUnit": "DiszpKrYNg8",
  "dataValues": [
    { "dataElement": "hP8Nw8b8", "value": 12 },
    { "dataElement": "xYz123", "value": 3 }
  ]
}
```

How it works:
- The route converts `dataValues` to strings and calls DHIS2 `api/dataValueSets`.
- Errors from DHIS2 are propagated in the response.

Next steps:
- Add mapping tables to convert local metrics (patients, visits, labs) to DHIS2 data element IDs.
- Add retry/backoff and logging.
- Add tests and example fixtures in `tests/integrations/dhis2`.

What's included now:
- DB-backed mappings: `migrations/0038_dhis2_mappings.sql` creates a `dhis2_mappings` table for production mapping management.
- CLI test harness: `scripts/dhis2-cli.js` with fixture at `tests/fixtures/patient.json` supports dry-run testing (`pnpm run dhis2:cli -- test-patient`).
- Dry-run support: Set `DHIS2_MAPPING_JSON` env var (JSON) or use the `dhis2_mappings` DB table when `DHIS2_USE_DB=true`.

How to configure mappings quickly (dev):
- Set `DHIS2_MAPPING_JSON` in your environment, e.g. in `.env.local`:

```env
DHIS2_MAPPING_JSON={"Patient": {"weight":"hP8Nw8b8","visitCount":"xYz123"}}
```

Or enable DB-backed mappings:

```env
DHIS2_USE_DB=true
DATABASE_URL=postgres://user:pass@localhost:5432/dbname
```

