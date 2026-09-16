const { buildMedicationUpdatePayload } = require('./lib/pharmacy-update-payload.ts')

const payload = buildMedicationUpdatePayload({
  name: 'Paracetamol',
  category: 'Analgesics',
  stockQuantity: 12,
  unitPrice: 5.5,
  is_controlled: true,
  schedule_class: 'Schedule 2',
  barcode: '123456',
})

const expected = {
  name: 'Paracetamol',
  category: 'Analgesics',
  stockQuantity: 12,
  unitPrice: 5.5,
  is_controlled: true,
  schedule_class: 'Schedule 2',
  barcode: '123456',
}

if (JSON.stringify(payload) !== JSON.stringify(expected)) {
  console.error('Payload mismatch')
  console.error(JSON.stringify(payload, null, 2))
  process.exit(1)
}

console.log('Pharmacy payload verification passed')
console.log(JSON.stringify(payload, null, 2))
