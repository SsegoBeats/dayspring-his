# Radiology Portal Smoke Tests

These Playwright smoke tests focus on the radiologist workflow:

- dashboard and worklist load
- radiologist settings expose radiology-specific defaults
- an existing study can be opened from the worklist
- external imaging upload flow works when fixture inputs are available

Required environment variables:

- `E2E_RADIOLOGIST_EMAIL`
- `E2E_RADIOLOGIST_PASSWORD`

Optional upload coverage variables:

- `E2E_RADIOLOGY_UPLOAD_PATIENT_QUERY`
- `E2E_RADIOLOGY_UPLOAD_FILE`
- `E2E_BASE_URL`
- `PLAYWRIGHT_SKIP_WEBSERVER`

Run:

```bash
npm run test:e2e:radiology
```

Headed:

```bash
npm run test:e2e:radiology:headed
```

If Playwright is not already installed in the environment, `npx` will need to fetch it before the first run.
