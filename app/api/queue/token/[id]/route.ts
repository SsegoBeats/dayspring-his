import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { queryWithSession } from "@/lib/db"
import { formatPatientNumber } from "@/lib/patients"
import { ORG_NAME, ORG_LOGO_PATH, ORG_SUBTITLE } from "@/lib/org-constants"

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function buildQueueTokenHtml({
  patientName,
  patientNumber,
  department,
  queuePosition,
  queueToken,
  checkinTime,
  renderMode,
}: {
  patientName: string
  patientNumber: string
  department: string
  queuePosition: string
  queueToken: string
  checkinTime: string
  renderMode: "browser" | "qz"
}) {
  const isDirectPrint = renderMode === "qz"
  const safePatientName = escapeHtml(patientName)
  const safePatientNumber = escapeHtml(patientNumber)
  const safeDepartment = escapeHtml(department)
  const safeQueuePosition = escapeHtml(queuePosition)
  const safeQueueToken = escapeHtml(queueToken)
  const safeCheckinTime = escapeHtml(checkinTime)
  const safeOrgName = escapeHtml(ORG_NAME)
  const safeSubtitle = escapeHtml(ORG_SUBTITLE)

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeOrgName} Queue Token</title>
    <style>
      :root {
        color-scheme: light;
        --paper-width: 72mm;
        --ink: #0f172a;
        --muted: #475569;
        --line: #cbd5e1;
        --accent: #0284c7;
        --accent-soft: #e0f2fe;
      }

      @page {
        size: 80mm auto;
        margin: 4mm;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #e2e8f0;
        color: var(--ink);
        font-family: "Segoe UI", Arial, sans-serif;
      }

      body {
        padding: 12px;
      }

      body.direct-print {
        padding: 0;
        background: white;
      }

      .controls {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-bottom: 12px;
      }

      .controls button {
        border: 1px solid var(--line);
        background: white;
        color: var(--ink);
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 12px;
        cursor: pointer;
      }

      .sheet {
        width: var(--paper-width);
        margin: 0 auto;
        background: white;
        border-radius: 12px;
        box-shadow: 0 24px 48px -28px rgba(15, 23, 42, 0.45);
        overflow: hidden;
      }

      .sheet.direct-print {
        width: auto;
        margin: 0;
        border-radius: 0;
        box-shadow: none;
      }

      .receipt {
        padding: 5mm 4.5mm 6mm;
      }

      .header {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        border-bottom: 1px dashed var(--line);
        padding-bottom: 10px;
      }

      .logo {
        width: 13mm;
        height: 13mm;
        object-fit: contain;
        margin-bottom: 6px;
      }

      .org-name {
        font-size: 14px;
        font-weight: 700;
        line-height: 1.2;
      }

      .org-subtitle {
        margin-top: 2px;
        font-size: 10px;
        color: var(--muted);
      }

      .token-title {
        margin-top: 10px;
        font-size: 10px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: var(--accent);
        font-weight: 700;
      }

      .queue-panel {
        margin-top: 10px;
        border: 1px solid #bae6fd;
        background: linear-gradient(180deg, var(--accent-soft), #ffffff);
        border-radius: 12px;
        padding: 10px 8px 12px;
        text-align: center;
      }

      .queue-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--muted);
      }

      .queue-value {
        margin-top: 4px;
        font-size: 34px;
        line-height: 1;
        font-weight: 800;
        letter-spacing: 0.06em;
      }

      .queue-department {
        margin-top: 6px;
        font-size: 13px;
        font-weight: 700;
      }

      .details {
        margin-top: 12px;
        border-top: 1px dashed var(--line);
        border-bottom: 1px dashed var(--line);
        padding: 10px 0;
      }

      .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
        font-size: 11px;
        padding: 3px 0;
      }

      .detail-label {
        color: var(--muted);
      }

      .detail-value {
        max-width: 38mm;
        text-align: right;
        font-weight: 600;
      }

      .footer {
        margin-top: 10px;
        text-align: center;
        font-size: 10px;
        line-height: 1.5;
        color: var(--muted);
      }

      .queue-token {
        margin-top: 8px;
        font-family: "Consolas", "Courier New", monospace;
        font-size: 10px;
        letter-spacing: 0.08em;
        color: var(--ink);
      }

      @media print {
        html,
        body {
          background: white;
          padding: 0;
        }

        .controls {
          display: none !important;
        }

        .sheet {
          width: auto;
          margin: 0;
          border-radius: 0;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body class="${isDirectPrint ? "direct-print" : ""}">
    ${isDirectPrint ? "" : `<div class="controls">
      <button type="button" onclick="window.print()">Print Token</button>
      <button type="button" onclick="window.close()">Close</button>
    </div>`}
    <div class="sheet${isDirectPrint ? " direct-print" : ""}">
      <main class="receipt">
        <header class="header">
          <img class="logo" src="${ORG_LOGO_PATH}" alt="${safeOrgName} logo" />
          <div class="org-name">${safeOrgName}</div>
          <div class="org-subtitle">${safeSubtitle}</div>
          <div class="token-title">Queue Token</div>
        </header>

        <section class="queue-panel">
          <div class="queue-label">Queue Position</div>
          <div class="queue-value">${safeQueuePosition}</div>
          <div class="queue-department">${safeDepartment}</div>
        </section>

        <section class="details">
          <div class="detail-row">
            <span class="detail-label">Patient</span>
            <span class="detail-value">${safePatientName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">P.ID</span>
            <span class="detail-value">${safePatientNumber}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Checked In</span>
            <span class="detail-value">${safeCheckinTime}</span>
          </div>
        </section>

        <div class="footer">
          Please keep this token and wait for your name or number to be called.
          <div class="queue-token">Token Ref: ${safeQueueToken}</div>
        </div>
      </main>
    </div>
    ${isDirectPrint ? "" : `<script>
      window.addEventListener("load", () => {
        window.setTimeout(() => {
          try {
            window.print()
          } catch {}
        }, 300)
      })
    </script>`}
  </body>
</html>`
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const url = new URL(req.url)
    const renderMode = url.searchParams.get("render") === "qz" ? "qz" : "browser"
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT q.id AS queue_id,
              q.department,
              q.status,
              q.position,
              c.id AS checkin_id,
              c.created_at AS checkin_time,
              p.patient_number,
              p.first_name,
              p.last_name
         FROM checkins c
         LEFT JOIN queues q ON q.checkin_id = c.id
         JOIN patients p ON p.id = c.patient_id
        WHERE c.id = $1
        LIMIT 1`,
      [id],
    )

    if (!rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const row: any = rows[0]
    const patientName = `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Patient"
    const patientNumber = formatPatientNumber(row.patient_number)
    const department = row.department || "Reception"
    const queuePosition =
      row.position !== null && row.position !== undefined ? String(row.position).padStart(2, "0") : "--"
    const queueToken = String(row.queue_id || row.checkin_id || "").slice(0, 8).toUpperCase()
    const checkinTime = new Date(row.checkin_time).toLocaleString()

    const html = buildQueueTokenHtml({
      patientName,
      patientNumber,
      department,
      queuePosition,
      queueToken,
      checkinTime,
      renderMode,
    })

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 })
  }
}
