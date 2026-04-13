QZ Tray Printing - Setup Guide

Overview
- This project supports optional silent printing via QZ Tray behind a feature flag.
- When enabled, the browser can enumerate printers and print receipts (80mm) without showing the OS print dialog.
- Browser fallback remains available if QZ Tray is not installed or disabled.

Prerequisites
1) Install QZ Tray on reception PCs
   - Download: https://qz.io/download
   - Install and allow it to run in the system tray on startup.

2) Generate signing materials (one-time, keep private key server-side)
   - QZ requires a certificate and signatures for security.
   - Generate an RSA keypair and a self-signed public certificate (PEM):
     - Private key (server-only): QZ_PRIVATE_KEY
     - Public cert (safe to share to clients): QZ_PUBLIC_CERT
   - You can use OpenSSL, for example:
     openssl genrsa -out qz-private.key 2048
     openssl req -new -x509 -key qz-private.key -out qz-public.crt -days 3650 -subj "/C=UG/ST=Central/L=Kampala/O=Dayspring/OU=IT/CN=dayspring.local"

3) Configure environment variables
   - Client flag:
     NEXT_PUBLIC_ENABLE_QZ_TRAY=true
     NEXT_PUBLIC_QZ_DEFAULT_PRINTER=RECEPTION RECEIPT   # optional, exact or partial match
   - Server secrets (do NOT commit private key):
     QZ_PUBLIC_CERT="""
     -----BEGIN CERTIFICATE-----
     ... your certificate here ...
     -----END CERTIFICATE-----
     """
     QZ_PRIVATE_KEY="""
     -----BEGIN PRIVATE KEY-----
     ... your private key here ...
     -----END PRIVATE KEY-----
     """

4) Trust the certificate in QZ Tray (optional but recommended)
   - Open QZ Tray -> Certificates -> Install (or manage) -> add your public certificate, or
   - Follow QZ signing/trust docs for your environment.

How it works in this repo
- Client util: lib/printing.ts
  - Dynamically loads qz-tray.js from CDN.
  - Sets certificate and signature promises.
  - Provides helpers to list printers and print the current receipt page.

- Server signing endpoint: app/api/printing/qz-sign/route.ts
  - GET ?mode=cert -> returns QZ_PUBLIC_CERT
  - POST { toSign } -> returns base64 RSA-SHA256 signature using QZ_PRIVATE_KEY

- Receipt page: app/patient-receipt/[id]/page.tsx
  - Print button: app/patient-receipt/[id]/PrintButton.tsx uses QZ when enabled, else falls back to window.print().
  - Automatically prints when opened with ?auto=1.

Usage
- In production, set the environment variables and restart the app.
- Ensure QZ Tray is running on the reception PC.
- On patient registration success, click "Print P.ID" - the receipt opens and auto-prints silently via QZ (if enabled and the printer is found). If anything fails, the button offers a manual print.

Troubleshooting
- "Missing QZ_PUBLIC_CERT" or "Missing QZ_PRIVATE_KEY": set the server env vars.
- "No printers found": verify QZ Tray is running; open QZ Tray and check printers; confirm the default printer name.
- SSL/Trust prompts: QZ requires trusted origins and certs. Use HTTPS in production and a trusted certificate. Refer to QZ docs for stricter deployments and certificate pinning.

Security Notes
- Never commit the private key. Keep it in environment variables or a secure secret store.
- Use HTTPS in production so the signing exchange is not intercepted.


