/**
 * Utility functions for validating lab test results and detecting critical values
 */

interface CriticalCheckResult {
  hasCritical: boolean
  criticalCount: number
  highCount: number
  lowCount: number
  criticalValues: Array<{ parameter: string; value: string; flag: 'H' | 'L'; severity: 'critical' | 'warning' }>
}

/**
 * Check if lab test results contain critical values
 */
export function checkCriticalValues(
  results: string,
  patientGender?: string | null,
  patientDob?: string | null
): CriticalCheckResult {
  const criticalValues: Array<{ parameter: string; value: string; flag: 'H' | 'L'; severity: 'critical' | 'warning' }> = []
  let highCount = 0
  let lowCount = 0
  let criticalCount = 0

  try {
    if (!results || typeof results !== 'string') {
      return { hasCritical: false, criticalCount: 0, highCount: 0, lowCount: 0, criticalValues: [] }
    }

    const rx = /(Hb|WBC|Platelets|HCT|MCV|Neut|Lymph|Mono|Eos|Baso|RBS|ALT|AST|ALP)\s*:\s*([^\n]+)/ig
    const toNum = (s: string) => {
      const m = String(s).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
      return m ? parseFloat(m[0]) : null
    }

    const sex = (patientGender || '').toLowerCase()
    const ageYears = (() => {
      if (!patientDob) return undefined
      const dob = new Date(patientDob)
      if (isNaN(dob.getTime())) return undefined
      const n = new Date()
      let y = n.getFullYear() - dob.getFullYear()
      const m = n.getMonth() - dob.getMonth()
      if (m < 0 || (m === 0 && n.getDate() < dob.getDate())) y--
      return Math.max(0, y)
    })()

    const ref = (k: string): [number | null, number | null] => {
      switch (k) {
        case 'Hb': {
          if (typeof ageYears === 'number' && ageYears < 12) return [11.5, 15.5]
          const female = sex === 'female'
          return [female ? 12 : 13, female ? 15.5 : 17]
        }
        case 'WBC': {
          if (typeof ageYears === 'number' && ageYears < 12) return [5, 15]
          return [4, 11]
        }
        case 'Platelets': return [150, 450]
        case 'HCT': {
          if (typeof ageYears === 'number' && ageYears < 12) return [35, 45]
          const female = sex === 'female'
          return [female ? 36 : 40, female ? 46 : 52]
        }
        case 'MCV': {
          if (typeof ageYears === 'number' && ageYears < 12) return [75, 95]
          return [80, 100]
        }
        case 'Neut': return [40, 75]
        case 'Lymph': return [20, 45]
        case 'Mono': return [2, 10]
        case 'Eos': return [1, 6]
        case 'Baso': return [0, 2]
        case 'RBS': return [3.9, 7.8]
        case 'ALT': return [7, 55]
        case 'AST': return [8, 48]
        case 'ALP': {
          if (typeof ageYears === 'number' && ageYears < 12) return [100, 350]
          return [40, 130]
        }
        default: return [null, null]
      }
    }

    let m: RegExpExecArray | null
    while ((m = rx.exec(results)) != null) {
      const k = m[1].replace(/\s+/g, ' ')
      const v = m[2].trim()
      const [lo, hi] = ref(k)
      const val = toNum(v)

      if (val != null && lo != null && hi != null) {
        if (val < lo) {
          lowCount++
          const isCritical = val < lo * 0.5
          if (isCritical) criticalCount++
          criticalValues.push({
            parameter: k,
            value: v,
            flag: 'L',
            severity: isCritical ? 'critical' : 'warning'
          })
        } else if (val > hi) {
          highCount++
          const isCritical = val > hi * 1.5
          if (isCritical) criticalCount++
          criticalValues.push({
            parameter: k,
            value: v,
            flag: 'H',
            severity: isCritical ? 'critical' : 'warning'
          })
        }
      }
    }
  } catch {
    // Return empty result on error
  }

  return {
    hasCritical: criticalCount > 0,
    criticalCount,
    highCount,
    lowCount,
    criticalValues
  }
}
