# Portal Smoke Tests

These Playwright smoke suites cover the main clinical/admin portals:

- Admin: dashboard drill-downs, finance deep links, admin settings defaults, URL-synced user filters
- Lab: operations hub, lab settings defaults, queue-to-detail navigation
- Receptionist: command desk routing, settings redirect, patient register actions, check-in to queue flow, payments/reports exports
- Radiology: command desk, radiology settings defaults, worklist navigation, optional upload flow

Required environment variables by suite:

- Admin:
  - `E2E_ADMIN_EMAIL`
  - `E2E_ADMIN_PASSWORD`
- Lab:
  - `E2E_LAB_TECH_EMAIL`
  - `E2E_LAB_TECH_PASSWORD`
- Receptionist:
  - No separate login env vars required when `DATABASE_URL` and `JWT_SECRET` are available; the suite signs in using the local receptionist account in the dataset
- Radiology:
  - `E2E_RADIOLOGIST_EMAIL`
  - `E2E_RADIOLOGIST_PASSWORD`

Optional radiology upload variables:

- `E2E_RADIOLOGY_UPLOAD_PATIENT_QUERY`
- `E2E_RADIOLOGY_UPLOAD_FILE`

Shared optional variables:

- `E2E_BASE_URL`
- `PLAYWRIGHT_SKIP_WEBSERVER`

Credential note:

- Provide approved credentials explicitly through your local environment or `.env.local`.
- The repo does not create or seed Admin, Lab, or Radiology test users.

Run:

```bash
npm run test:e2e:admin
npm run test:e2e:lab
npm run test:e2e:receptionist
npm run test:e2e:radiology
```

Headed:

```bash
npm run test:e2e:admin:headed
npm run test:e2e:lab:headed
npm run test:e2e:receptionist:headed
npm run test:e2e:radiology:headed
```

If Playwright is not already installed in the environment, `npx` will need to fetch it before the first run.
