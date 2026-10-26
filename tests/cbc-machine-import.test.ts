require("ts-node/register/transpile-only")

const test = require("node:test")
const assert = require("node:assert/strict")
const { isCbcTest, parseCbcMachineCsv } = require("../lib/cbc-machine-import.ts")

const validCsv = [
  "accession_number,patient_number,parameter,value,units,reference,flag",
  "ACC-123,P0001,WBC,5.4,10^9/L,4.0-11.0,Normal",
  'ACC-123,P0001,"Hemoglobin, blood",13.2,g/dL,12.0-16.0,N',
].join("\r\n")

test("parses matching CBC analyzer CSV rows and normalizes flags", () => {
  const result = parseCbcMachineCsv(`\uFEFF${validCsv}`, "ACC-123", "P0001")
  assert.equal(result.rows.length, 2)
  assert.equal(result.rows[0].name, "WBC")
  assert.equal(result.rows[0].flag, "Normal")
  assert.equal(result.rows[1].name, "Hemoglobin, blood")
  assert.equal(result.rows[1].value, "13.2")
})

test("requires the current order accession", () => {
  assert.throws(
    () => parseCbcMachineCsv(validCsv.replace("ACC-123", "ACC-999"), "ACC-123", "P0001"),
    /accession does not match/,
  )
})

test("rejects a mismatched patient number", () => {
  assert.throws(() => parseCbcMachineCsv(validCsv, "ACC-123", "P0002"), /patient number does not match/)
})

test("rejects duplicate result names and unsupported flags", () => {
  const duplicate = `${validCsv}\r\nACC-123,P0001,WBC,6.1,10^9/L,4.0-11.0,Normal`
  assert.throws(() => parseCbcMachineCsv(duplicate, "ACC-123", "P0001"), /duplicate parameter/)
  assert.throws(
    () => parseCbcMachineCsv(validCsv.replace("Normal", "Unknown"), "ACC-123", "P0001"),
    /Unsupported result flag/,
  )
})

test("rejects malformed CSV and missing accession", () => {
  assert.throws(() => parseCbcMachineCsv("accession_number,parameter,value\r\nACC-123,WBC,\"5.4", "ACC-123"), /not closed/)
  assert.throws(() => parseCbcMachineCsv(validCsv, "", "P0001"), /no accession number/)
})

test("identifies common CBC names and LOINC code", () => {
  assert.equal(isCbcTest({ testName: "Complete blood count with differential" }), true)
  assert.equal(isCbcTest({ testType: "FBC" }), true)
  assert.equal(isCbcTest({ loincCode: "58410-2" }), true)
  assert.equal(isCbcTest({ testName: "Malaria smear" }), false)
})
