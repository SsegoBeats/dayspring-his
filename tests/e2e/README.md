# Portal Smoke Tests

These Playwright smoke suites cover the main clinical/admin portals:

- Admin: dashboard drill-downs, finance deep links, admin settings defaults, URL-synced user filters
- Lab: operations hub, lab settings defaults, queue-to-detail navigation
- Radiology: command desk, radiology settings defaults, worklist navigation, optional upload flow

Required environment variables by suite:

- Admin:
  - `E2E_ADMIN_EMAIL`
  - `E2E_ADMIN_PASSWORD`
- Lab:
  - `E2E_LAB_TECH_EMAIL`
  - `E2E_LAB_TECH_PASSWORD`
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
npm run test:e2e:radiology
```

Headed:

```bash
npm run test:e2e:admin:headed
npm run test:e2e:lab:headed
npm run test:e2e:radiology:headed
```

If Playwright is not already installed in the environment, `npx` will need to fetch it before the first run.
