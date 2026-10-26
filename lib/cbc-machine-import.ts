import type { ParameterRow } from "@/lib/lab-parameters"

export interface CbcImportRow {
  name: string
  value: string
  units: string
  reference: string
  flag: ParameterRow["flag"]
  active: true
}

export interface CbcImportResult {
  rows: CbcImportRow[]
  accessionNumber: string
  patientNumber: string | null
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  let closedQuote = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
          closedQuote = true
        }
      } else {
        field += char
      }
      continue
    }

    if (closedQuote && char !== "," && char !== "\r" && char !== "\n" && char !== " " && char !== "\t") {
      throw new Error("Invalid CSV: unexpected text after a quoted field.")
    }
    if (char === '"') {
      if (field.length > 0 || closedQuote) throw new Error("Invalid CSV: unexpected quote.")
      quoted = true
    } else if (char === ",") {
      row.push(field.trim())
      field = ""
      closedQuote = false
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && input[index + 1] === "\n") index += 1
      row.push(field.trim())
      if (row.some((value) => value !== "")) rows.push(row)
      row = []
      field = ""
      closedQuote = false
    } else {
      if (closedQuote && (char === " " || char === "\t")) continue
      field += char
    }
  }

  if (quoted) throw new Error("Invalid CSV: a quoted field was not closed.")
  row.push(field.trim())
  if (row.some((value) => value !== "")) rows.push(row)
  return rows
}

function normalizeFlag(value: string): ParameterRow["flag"] {
  switch (value.trim().toLowerCase()) {
    case "n":
    case "normal":
      return "Normal"
    case "l":
    case "low":
      return "Low"
    case "h":
    case "high":
      return "High"
    case "ll":
    case "hh":
    case "critical":
      return "Critical"
    case "":
      return ""
    default:
      throw new Error(`Unsupported result flag "${value}". Use Normal, Low, High, or Critical.`)
  }
}

export function parseCbcMachineCsv(
  input: string,
  expectedAccessionNumber: string,
  expectedPatientNumber?: string | null,
): CbcImportResult {
  if (input.length > 1_000_000) throw new Error("CSV file exceeds the 1 MB limit.")
  if (!expectedAccessionNumber.trim()) throw new Error("This test has no accession number; use manual result entry.")

  const parsedRows = parseCsvRows(input.replace(/^\uFEFF/, ""))
  if (parsedRows.length < 2) throw new Error("CSV must contain a header and at least one result row.")
  if (parsedRows.length > 201) throw new Error("CSV may contain no more than 200 result rows.")
  if (parsedRows[0].length > 20) throw new Error("CSV contains too many columns.")

  const headers = parsedRows[0].map((header) => header.trim().toLowerCase())
  if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate column headings.")
  const indexOf = (header: string) => headers.indexOf(header)
  const accessionIndex = indexOf("accession_number")
  const parameterIndex = indexOf("parameter")
  const valueIndex = indexOf("value")
  if (accessionIndex < 0 || parameterIndex < 0 || valueIndex < 0) {
    throw new Error("CSV must include accession_number, parameter, and value columns.")
  }

  const patientIndex = indexOf("patient_number")
  const unitsIndex = indexOf("units")
  const referenceIndex = indexOf("reference")
  const flagIndex = indexOf("flag")
  const expectedAccession = expectedAccessionNumber.trim().toLowerCase()
  const expectedPatient = expectedPatientNumber?.trim().toLowerCase() || null
  const names = new Set<string>()
  const rows: CbcImportRow[] = []

  for (const [rowIndex, cells] of parsedRows.slice(1).entries()) {
    if (cells.length !== headers.length) {
      throw new Error(`CSV row ${rowIndex + 2} has ${cells.length} columns; expected ${headers.length}.`)
    }
    const accession = cells[accessionIndex]?.trim()
    const name = cells[parameterIndex]?.trim()
    const value = cells[valueIndex]?.trim()
    if (!accession || accession.toLowerCase() !== expectedAccession) {
      throw new Error(`CSV row ${rowIndex + 2} accession does not match this test (${expectedAccessionNumber}).`)
    }
    if (patientIndex >= 0 && expectedPatient) {
      const patientNumber = cells[patientIndex]?.trim()
      if (patientNumber && patientNumber.toLowerCase() !== expectedPatient) {
        throw new Error(`CSV row ${rowIndex + 2} patient number does not match this order.`)
      }
    }
    if (!name || name.length > 100) throw new Error(`CSV row ${rowIndex + 2} has an invalid parameter name.`)
    if (!value || value.length > 100) throw new Error(`CSV row ${rowIndex + 2} has an invalid or empty result value.`)
    const key = name.toLowerCase()
    if (names.has(key)) throw new Error(`CSV contains duplicate parameter "${name}".`)
    names.add(key)

    rows.push({
      name,
      value,
      units: (unitsIndex >= 0 ? cells[unitsIndex] : "").slice(0, 40).trim(),
      reference: (referenceIndex >= 0 ? cells[referenceIndex] : "").slice(0, 80).trim(),
      flag: flagIndex >= 0 ? normalizeFlag(cells[flagIndex]) : "",
      active: true,
    })
  }

  return {
    rows,
    accessionNumber: expectedAccessionNumber,
    patientNumber: expectedPatientNumber?.trim() || null,
  }
}

export function isCbcTest(test: { testName?: string | null; testType?: string | null; loincCode?: string | null }): boolean {
  if (test.loincCode === "58410-2") return true
  return [test.testName, test.testType].some((value) =>
    /(^|[^a-z])(cbc|fbc|hemogram|haemogram|complete blood count|full blood count)([^a-z]|$)/i.test(value || ""),
  )
}
