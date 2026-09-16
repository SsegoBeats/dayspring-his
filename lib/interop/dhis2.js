"use strict"
exports.buildDataValueSet = function(period, orgUnit, dataValues) {
  return {
    dataValues: dataValues.map(function(dv){ return { dataElement: String(dv.dataElement), value: String(dv.value) } }),
    period: period,
    orgUnit: orgUnit,
  }
}

exports.mapResourceToDataValues = function(resourceType, resource, facilityId) {
  var raw = process.env.DHIS2_MAPPING_JSON || '{}'
  var cfg = {}
  try { cfg = JSON.parse(raw) } catch(e) { cfg = {} }

  var mapForType = cfg[resourceType] || {}
  var out = []
  // If DB-backed mappings are enabled, try to load them
  if (process.env.DHIS2_USE_DB === 'true' && process.env.DATABASE_URL) {
    try {
      var Client = require('pg').Client
      var client = new Client({ connectionString: process.env.DATABASE_URL })
      ;(async function(){
        await client.connect()
        var res = await client.query('SELECT field, data_element FROM dhis2_mappings WHERE resource_type = $1', [resourceType])
        res.rows.forEach(function(row){ var val = resource[row.field]; if (val !== undefined && val !== null) out.push({ dataElement: String(row.data_element), value: val }) })
        await client.end()
      })()
    } catch(e) {
      // ignore
    }
  }
  for (var key in mapForType) {
    var de = mapForType[key]
    var val = resource[key]
    if (val !== undefined && val !== null) out.push({ dataElement: String(de), value: val })
  }
  if (Array.isArray(resource.dhis2DataValues)) {
    resource.dhis2DataValues.forEach(function(dv){ if (dv.dataElement && dv.value !== undefined) out.push({ dataElement: dv.dataElement, value: dv.value }) })
  }
  if (facilityId && cfg.__facilityMappings) {
    cfg.__facilityMappings.forEach(function(fm){ if (!fm.facilityId || fm.facilityId === facilityId) out.push({ dataElement: fm.dataElement, value: fm.value }) })
  }
  return out
}

exports.pushDataValueSet = async function(dvs, opts) {
  opts = opts || {}
  var base = process.env.DHIS2_BASE_URL
  var user = process.env.DHIS2_USERNAME
  var pass = process.env.DHIS2_PASSWORD
  // Allow dry-run without configured DHIS2_BASE_URL (useful for local testing)
  if (opts.dryRun) return { dryRun: true, payload: dvs }
  if (!base) throw new Error('DHIS2_BASE_URL not configured in environment')
  var url = (base.replace(/\/+$/, '')) + '/api/dataValueSets'
  var headers = { 'Content-Type': 'application/json' }
  if (user && pass) headers['Authorization'] = 'Basic ' + Buffer.from(user + ':' + pass).toString('base64')

  var batchSize = opts.batchSize || 500
  var maxRetries = (typeof opts.maxRetries !== 'undefined') ? opts.maxRetries : (opts.retries || 4)
  var batches = []
  for (var i = 0; i < dvs.dataValues.length; i += batchSize) {
    var slice = dvs.dataValues.slice(i, i + batchSize)
    // shallow copy dvs with sliced dataValues
    var p = Object.assign({}, dvs)
    p.dataValues = slice
    batches.push(p)
  }

  var results = []
  for (var b = 0; b < batches.length; b++) {
    var payload = batches[b]
    var attempt = 0
    var lastErr = null
    while (attempt <= maxRetries) {
      try {
        attempt++
        var res = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(payload) })
        var text = await res.text()
        if (res.ok) { results.push({ ok: true, status: res.status }); break }
        if (res.status === 409 || res.status === 412) { results.push({ ok: true, status: res.status, note: 'idempotent conflict' }); break }
        lastErr = new Error('DHIS2 push failed (' + res.status + '): ' + text)
        if (attempt > maxRetries) throw lastErr
        var backoff = Math.min(30000, 500 * Math.pow(2, attempt))
        await new Promise(function(r){ setTimeout(r, backoff + Math.floor(Math.random() * 200)) })
      } catch (err) {
        lastErr = err
        if (attempt > maxRetries) throw err
        var backoff = Math.min(30000, 500 * Math.pow(2, attempt))
        await new Promise(function(r){ setTimeout(r, backoff + Math.floor(Math.random() * 200)) })
      }
    }
  }
  return { ok: true, batches: results }
}
