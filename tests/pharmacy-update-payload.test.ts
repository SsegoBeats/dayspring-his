require("ts-node/register/transpile-only")

const test = require("node:test")
const assert = require("node:assert/strict")
const { buildMedicationUpdatePayload } = require("../lib/pharmacy-update-payload.ts")

test("buildMedicationUpdatePayload includes controlled-drug fields and omits empty values", () => {
  const payload = buildMedicationUpdatePayload({
    name: "Paracetamol",
    category: "Analgesics",
    stockQuantity: 12,
    unitPrice: 5.5,
    is_controlled: true,
    schedule_class: "Schedule 2",
    barcode: "123456",
  })

  assert.deepEqual(payload, {
    name: "Paracetamol",
    category: "Analgesics",
    stockQuantity: 12,
    unitPrice: 5.5,
    is_controlled: true,
    schedule_class: "Schedule 2",
    barcode: "123456",
  })
})
