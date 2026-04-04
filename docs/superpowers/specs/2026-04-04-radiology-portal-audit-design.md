# Radiology Portal — Full Audit & Inspection Design

**Date:** 2026-04-04  
**Scope:** Complete layered audit of all Radiology Portal pages, components, APIs, exports, settings, and cross-portal integration flows.  
**Branch:** `main`  
**Uncommitted changes from previous session:** 12 modified files + 1 new file (see git status)

---

## Goals

1. Verify every API route is correct: auth guards, SQL, filters, error handling, notification routing
2. Verify every UI component handles all states: loading, error, empty, and populated
3. Verify cross-portal notification flow is bidirectional and complete
4. Verify all export formats produce correct, filtered, fully-populated data
5. Verify the new workflow settings component persists and reloads correctly
6. Fix every issue found during inspection
7. Commit all changes (last session's + this session's) in a single atomic commit

---

## Surface Area

### Pages
| Path | Description |
|---|---|
| `app/radiologist/page.tsx` | Main dashboard and worklist |
| `app/radiologist/settings/page.tsx` | Settings page (profile, workflow, preferences, email, password, notifications) |

### Components
| File | Responsibility |
|---|---|
| `components/dashboards/radiologist-dashboard.tsx` | Dashboard: stat cards, worklist table, modality/assignment charts, hero banner |
| `components/radiology/radiology-test-queue.tsx` | Worklist queue table with filter, sort, priority coloring |
| `components/radiology/radiology-test-details.tsx` | Study detail dialog: overview, results entry, history, assign, complete, cancel |
| `components/radiology/image-viewer.tsx` | Image/DICOM viewer with zoom, rotate, reset controls |
| `components/settings/radiologist-workflow-settings.tsx` | Workflow preferences card (new) |

### API Routes
| Route | Methods | Purpose |
|---|---|---|
| `/api/lab-tests` | GET, POST | List studies (filtered), create new study |
| `/api/lab-tests/[id]` | GET, PATCH, DELETE | Get, update (assign/start/complete/cancel), delete study |
| `/api/lab-tests/stream` | GET (SSE) | Real-time study updates stream |
| `/api/lab-tests/csv` | GET | CSV export |
| `/api/lab-tests/pdf` | GET | PDF export (bulk) |
| `/api/lab-tests/xlsx` | GET | XLSX export |
| `/api/lab-tests/[id]/pdf` | GET | Per-study PDF report |
| `/api/users/radiologists` | GET | Radiologist list for assignment dropdown |
| `/api/settings/preferences` | GET, POST, PATCH | User preferences (core + JSONB extra_prefs) |
| `/api/notifications` | GET, PATCH | Notification list and mark-as-read |
| `/api/notifications/stream` | GET (SSE) | Real-time notification stream |

### Library / Core
| File | Purpose |
|---|---|
| `lib/radiology.ts` | RADIOLOGY_MODALITIES constant, structured report templates, resolver |
| `lib/exports/datasets/radiology.ts` | RadiologyDataset export class |
| `lib/exports/datasets/radiology-lab-tests.ts` | RadiologyLabTestsDataset export class |

---

## Inspection Layers

### Layer 1: API / DB

**Checklist per route:**
- Auth guard present and correct (verifyToken + role check)
- SQL uses parameterized queries (no string interpolation)
- All filters work correctly (case normalization where needed)
- Correct HTTP status codes on error paths
- Notification side-effects fire to the right audience
- Audit log written where appropriate

**Key risks to check:**
- Modality detection uses all 9 modalities (X-Ray, CT Scan, MRI, Ultrasound, Mammography, Fluoroscopy, Nuclear Medicine, PET Scan, Angiography) in both `route.ts` and `[id]/route.ts`
- Status filter normalization: `"in-progress"` (kebab) vs `"In Progress"` (DB)
- JSONB merge in `extra_prefs` is safe partial update (not full replace)
- SSE stream closes cleanly on disconnect

### Layer 2: UI / Components

**Checklist per component:**
- Loading state shown while fetching
- Error state shown and user-friendly (no raw error objects exposed)
- Empty state shown when no data
- All interactive elements (buttons, selects, switches) wire to correct handlers
- Optimistic updates or proper refetch after mutations
- No hardcoded data that should come from API
- TypeScript types are tight (no `any` in hot paths)

**Key risks to check:**
- `radiologist-dashboard.tsx`: completion rate and avg turnaround computed correctly from real data
- `radiology-test-queue.tsx`: priority coloring uses correct field (`priority` vs `status`)
- `radiology-test-details.tsx`: assign dialog populates radiologist list from API, not hardcoded
- `image-viewer.tsx`: reset button uses RefreshCcw (not X), zoom/rotate work correctly
- `radiologist-workflow-settings.tsx`: dirty-check prevents unnecessary saves, all 6 fields save/reload

### Layer 3: Cross-Portal Integration

**Notification flows to verify:**
| Event | Sender | Recipients | Type |
|---|---|---|---|
| Study ordered (radiology modality) | Doctor/Clinician | All active Radiologists | `Radiology` |
| Study assigned to radiologist | Radiologist | Ordering doctor | `Radiology` — verify fires in PATCH handler |
| Study completed | Radiologist | Ordering doctor | `Radiology` — verify fires in PATCH handler |
| Study cancelled | Radiologist | Ordering doctor | `Radiology` — verify fires in PATCH handler |
| STAT study ordered | Doctor/Clinician | All active Radiologists | `Radiology`, priority=`High` |

**SSE + DOM event:**
- `openRadiologyStudy` custom DOM event dispatched when radiologist clicks notification
- Event carries `studyId` and handler in dashboard layout opens the correct study dialog

### Layer 4: Settings + Exports

**Settings:**
- `extra_prefs` JSONB column auto-created via `ensurePreferenceColumns()` on first request
- `GET` spreads `extra_prefs` into response object
- `PATCH` merges (not replaces) into `extra_prefs`
- `radiologistWorkflow` key round-trips: save with PATCH → reload with GET → all 6 fields present

**Exports:**
- All exports filter by modality using correct case normalization (LOWER on both sides)
- Status filters normalize dashes-to-spaces
- Date range filters applied correctly
- CSV, XLSX, PDF each include: accession number, modality, patient name, priority, ordered date, completed date, assigned radiologist, status
- Per-study PDF includes: structured report sections, patient demographics, priority label

---

## Success Criteria

- [ ] All API routes respond correctly to valid requests
- [ ] All API routes return 401 for unauthenticated, 403 for unauthorized roles
- [ ] All 9 modalities detected correctly for notification routing
- [ ] All components handle loading/error/empty states
- [ ] Worklist priority coloring works for STAT and overdue
- [ ] Notifications fire correctly in all 5 scenarios above
- [ ] Export data includes all 9 modalities and correct columns
- [ ] `radiologistWorkflow` preferences persist and reload correctly
- [ ] No TypeScript errors introduced by last session's changes
- [ ] All 12 modified + 1 new file committed atomically

---

## Inspection Order

1. `lib/radiology.ts` — core types and modality list
2. `app/api/lab-tests/route.ts` — list + create
3. `app/api/lab-tests/[id]/route.ts` — update flows
4. `app/api/lab-tests/stream/route.ts` — SSE
5. `app/api/lab-tests/csv|pdf|xlsx` routes — bulk exports
6. `app/api/lab-tests/[id]/pdf/route.ts` — per-study PDF
7. `app/api/users/radiologists/route.ts` — assignment list
8. `app/api/settings/preferences/route.ts` — preferences API
9. `lib/exports/datasets/radiology.ts` — RadiologyDataset
10. `lib/exports/datasets/radiology-lab-tests.ts` — RadiologyLabTestsDataset
11. `components/dashboards/radiologist-dashboard.tsx`
12. `components/radiology/radiology-test-queue.tsx`
13. `components/radiology/radiology-test-details.tsx`
14. `components/radiology/image-viewer.tsx`
15. `components/settings/radiologist-workflow-settings.tsx`
16. `app/radiologist/page.tsx` — main page wiring
17. `app/radiologist/settings/page.tsx` — settings page wiring
18. Cross-portal notification flows (read notification route + lab-tests routes together)
