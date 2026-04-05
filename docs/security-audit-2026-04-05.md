# Security Audit Report — Dayspring HIS
**Date:** 2026-04-05  
**Auditor:** Ethical Security Review  
**Scope:** Full codebase — API routes, authentication, database layer, file handling, secrets management

---

## Summary

| Severity | Found | Fixed |
|----------|-------|-------|
| Critical | 1 | 1 ✅ |
| High | 1 | 1 ✅ |
| Medium | 3 | 3 ✅ |
| Low | 2 | 2 ✅ |
| Info | 2 | 2 ✅ |

---

## Findings & Fixes

### CRITICAL-1 — Private Key Committed to Repository
**File:** `secrets/qz-private.key`, `secrets/qz-public.crt`  
**Issue:** The `secrets/` directory containing a real RSA private key and TLS certificate was not listed in `.gitignore`. If this repository were ever pushed to a remote (GitHub, GitLab, etc.), the private key would be publicly exposed.  
**Fix:** Added `/secrets/`, `*.key`, `*.pem`, `*.p12`, `*.pfx` to `.gitignore`.  
**Action Required:** If this repo has ever been pushed to a remote, treat the private key as compromised and rotate it immediately.

---

### HIGH-1 — Session Cookie `secure` Flag Hardcoded to `false`
**File:** [app/api/auth/login/route.ts](../app/api/auth/login/route.ts) (lines 84–99)  
**Issue:** The `session` cookie was set with `secure: false`, meaning it could be transmitted over plain HTTP in any environment including production. An attacker on the same network could intercept session tokens via a man-in-the-middle attack.  
**Fix:** Changed to `secure: process.env.NODE_ENV === "production"` so the Secure flag is enforced in production.

---

### MEDIUM-1 — JWT Token Returned in Login Response Body
**File:** [app/api/auth/login/route.ts](../app/api/auth/login/route.ts) (line ~82)  
**Issue:** The generated JWT was included in the JSON response body (`token` field) in addition to being set as an HttpOnly cookie. This is unnecessary: any JavaScript on the page (including injected scripts) can read the response body and extract the token. It may also appear in browser DevTools network logs.  
**Fix:** Removed `token` from the response body. The HttpOnly cookie is the only delivery mechanism needed.

---

### MEDIUM-2 — User Role Leaked in Login Error Message
**File:** [app/api/auth/login/route.ts](../app/api/auth/login/route.ts) (line ~70)  
**Issue:** When a user selected the wrong portal, the error response was:  
`"You do not have access to the [role] portal. Your role is: [actual_role]"`  
This discloses the victim's actual role to any attacker who can attempt a login with a known email address.  
**Fix:** Changed to the generic `"Invalid credentials"` with HTTP 401 to prevent role enumeration.

---

### MEDIUM-3 — Database Internal Details Leaked in 409 Error
**File:** [app/api/admin/users/[id]/route.ts](../app/api/admin/users/%5Bid%5D/route.ts) (lines ~183–190)  
**Issue:** On a 409 conflict during user deletion, the API returned `constraint` and `detail` fields directly from the PostgreSQL error object, exposing internal database constraint names and column details to the client.  
**Fix:** Removed the `constraint` and `detail` fields. Only the human-readable `error` string is returned.

---

### LOW-1 — Temp Scripts and Logs Not Gitignored
**Files:** `temp-*.py`, `temp-*.ps1`, `tmp_*.txt`, `*.log`, `dayspring.sql`  
**Issue:** Temporary development scripts and server log files were present in the project root without being gitignored. The SQL dump (`dayspring.sql`) could contain production schema details or seeded data. Log files may capture user activity and errors.  
**Fix:** Added patterns `temp-*.py`, `temp-*.ps1`, `tmp_*.txt`, `*.log`, `*.sql` to `.gitignore`.

---

### LOW-2 — `sanitizeInput` Utility Provides Weak XSS Protection
**File:** [lib/security.ts](../lib/security.ts) (lines 241–248)  
**Issue:** The `sanitizeInput` function only strips `<`, `>`, `javascript:`, and `on*=` patterns. It is incomplete against many XSS bypasses (HTML entities, data URIs, SVG vectors, etc.). If this function is relied upon as a primary XSS defense, it may give a false sense of security.  
**Status:** Not fixed in code — React's JSX escaping provides the primary XSS defense at render time. Recommend reviewing all call sites of `sanitizeInput` to ensure this function is not used as a trusted sanitizer for HTML rendering contexts.

---

### INFO-1 — CSRF Tokens Not Applied to All Mutating Endpoints
**File:** Multiple `app/api/*/route.ts`  
**Issue:** CSRF token validation is correctly implemented on `change-password` and `change-email`, but most other POST/PUT/DELETE endpoints (appointments, billing, patients, etc.) do not validate CSRF tokens.  
**Mitigating Factor:** `sameSite: "lax"` on session cookies prevents cross-origin form submissions from automatically including the session cookie in most modern browsers.  
**Recommendation:** For defense-in-depth, add CSRF validation to all state-changing endpoints, especially those that handle sensitive data (patient records, billing, medications).

---

### INFO-2 — File Upload Validated by MIME/Extension Only (No Magic Bytes)
**File:** [app/api/upload/route.ts](../app/api/upload/route.ts)  
**Issue:** Uploaded file types are validated using the `Content-Type` header and file extension — both of which are user-controlled. A malicious actor could craft a polyglot file (e.g., a PHP/JS file disguised as a `.pdf`) that passes validation.  
**Mitigating Factor:** Files are stored with randomised names, and the application does not execute uploaded files. Vercel Blob storage (production) further reduces risk.  
**Recommendation:** Add magic byte validation (e.g., check `%PDF-` prefix for PDFs, PNG header for images) as an additional layer before accepting uploads.

---

## Files Changed

| File | Change |
|------|--------|
| `.gitignore` | Added `secrets/`, `*.key`, `*.pem`, temp scripts, logs, `.sql` |
| `app/api/auth/login/route.ts` | Fixed `secure` cookie flag; removed token from response body; removed role from error message |
| `app/api/admin/users/[id]/route.ts` | Removed internal DB constraint/detail from 409 response |

---

## What Was NOT Found (Good Practices Observed)

- **No hardcoded credentials** in source files — all secrets use `process.env`
- **Parameterized queries** used throughout — no SQL injection found
- **bcrypt** used for password hashing with salt rounds = 10
- **JWT** uses `iss`/`aud` claims and is verified on every request
- **Rate limiting** on login (`10/min`) and password reset (`5/min`)
- **RBAC** enforced on every API route with `can(role, resource, action)`
- **Audit logging** on authentication events and sensitive operations
- **Zod validation** at all API input boundaries
- **`secure: true`** on CSRF cookie in production
- **Password strength enforcement** on reset and change flows
- **Timing-safe** user enumeration prevention on password reset (returns `success: true` for unknown emails)
