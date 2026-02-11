/**
 * Vital Signs Validation Utility
 * Provides validation and alerting for abnormal vital signs based on age and clinical standards
 */

export interface VitalSignsRanges {
  temperature: { min: number; max: number; criticalLow: number; criticalHigh: number }
  systolicBP: { min: number; max: number; criticalLow: number; criticalHigh: number }
  diastolicBP: { min: number; max: number; criticalLow: number; criticalHigh: number }
  heartRate: { min: number; max: number; criticalLow: number; criticalHigh: number }
  respiratoryRate: { min: number; max: number; criticalLow: number; criticalHigh: number }
  oxygenSaturation: { min: number; max: number; criticalLow: number }
}

export interface VitalSignsAlert {
  type: 'critical' | 'warning' | 'normal'
  message: string
  field: string
}

/**
 * Get normal vital signs ranges based on patient age
 */
export function getVitalSignsRanges(ageYears: number | null): VitalSignsRanges {
  const isPediatric = ageYears !== null && ageYears < 12
  const isInfant = ageYears !== null && ageYears < 1

  if (isInfant) {
    // Infant ranges (0-1 year)
    return {
      temperature: { min: 36.1, max: 37.7, criticalLow: 35.0, criticalHigh: 38.5 },
      systolicBP: { min: 70, max: 100, criticalLow: 60, criticalHigh: 120 },
      diastolicBP: { min: 40, max: 60, criticalLow: 30, criticalHigh: 80 },
      heartRate: { min: 100, max: 160, criticalLow: 80, criticalHigh: 180 },
      respiratoryRate: { min: 30, max: 50, criticalLow: 20, criticalHigh: 60 },
      oxygenSaturation: { min: 95, max: 100, criticalLow: 90 },
    }
  } else if (isPediatric) {
    // Pediatric ranges (1-12 years)
    return {
      temperature: { min: 36.5, max: 37.5, criticalLow: 35.0, criticalHigh: 39.0 },
      systolicBP: { min: 80, max: 110, criticalLow: 70, criticalHigh: 130 },
      diastolicBP: { min: 50, max: 70, criticalLow: 40, criticalHigh: 85 },
      heartRate: { min: 70, max: 120, criticalLow: 60, criticalHigh: 140 },
      respiratoryRate: { min: 20, max: 30, criticalLow: 15, criticalHigh: 40 },
      oxygenSaturation: { min: 95, max: 100, criticalLow: 90 },
    }
  } else {
    // Adult ranges (12+ years)
    return {
      temperature: { min: 36.1, max: 37.2, criticalLow: 35.0, criticalHigh: 40.0 },
      systolicBP: { min: 90, max: 140, criticalLow: 80, criticalHigh: 180 },
      diastolicBP: { min: 60, max: 90, criticalLow: 50, criticalHigh: 120 },
      heartRate: { min: 60, max: 100, criticalLow: 40, criticalHigh: 130 },
      respiratoryRate: { min: 12, max: 20, criticalLow: 10, criticalHigh: 30 },
      oxygenSaturation: { min: 95, max: 100, criticalLow: 90 },
    }
  }
}

/**
 * Validate vital signs and return alerts for abnormal values
 */
export function validateVitalSigns(
  vitals: {
    temperature?: number | null
    systolicBP?: number | null
    diastolicBP?: number | null
    heartRate?: number | null
    respiratoryRate?: number | null
    oxygenSaturation?: number | null
  },
  ageYears: number | null
): VitalSignsAlert[] {
  const ranges = getVitalSignsRanges(ageYears)
  const alerts: VitalSignsAlert[] = []

  // Temperature validation
  if (vitals.temperature !== null && vitals.temperature !== undefined) {
    if (vitals.temperature <= ranges.temperature.criticalLow || vitals.temperature >= ranges.temperature.criticalHigh) {
      alerts.push({
        type: 'critical',
        field: 'temperature',
        message: `Critical temperature: ${vitals.temperature.toFixed(1)}°C (Normal: ${ranges.temperature.min}-${ranges.temperature.max}°C)`,
      })
    } else if (vitals.temperature < ranges.temperature.min || vitals.temperature > ranges.temperature.max) {
      alerts.push({
        type: 'warning',
        field: 'temperature',
        message: `Abnormal temperature: ${vitals.temperature.toFixed(1)}°C (Normal: ${ranges.temperature.min}-${ranges.temperature.max}°C)`,
      })
    }
  }

  // Blood Pressure validation
  if (vitals.systolicBP !== null && vitals.systolicBP !== undefined) {
    if (vitals.systolicBP <= ranges.systolicBP.criticalLow || vitals.systolicBP >= ranges.systolicBP.criticalHigh) {
      alerts.push({
        type: 'critical',
        field: 'systolicBP',
        message: `Critical systolic BP: ${vitals.systolicBP} mmHg (Normal: ${ranges.systolicBP.min}-${ranges.systolicBP.max} mmHg)`,
      })
    } else if (vitals.systolicBP < ranges.systolicBP.min || vitals.systolicBP > ranges.systolicBP.max) {
      alerts.push({
        type: 'warning',
        field: 'systolicBP',
        message: `Abnormal systolic BP: ${vitals.systolicBP} mmHg (Normal: ${ranges.systolicBP.min}-${ranges.systolicBP.max} mmHg)`,
      })
    }
  }

  if (vitals.diastolicBP !== null && vitals.diastolicBP !== undefined) {
    if (vitals.diastolicBP <= ranges.diastolicBP.criticalLow || vitals.diastolicBP >= ranges.diastolicBP.criticalHigh) {
      alerts.push({
        type: 'critical',
        field: 'diastolicBP',
        message: `Critical diastolic BP: ${vitals.diastolicBP} mmHg (Normal: ${ranges.diastolicBP.min}-${ranges.diastolicBP.max} mmHg)`,
      })
    } else if (vitals.diastolicBP < ranges.diastolicBP.min || vitals.diastolicBP > ranges.diastolicBP.max) {
      alerts.push({
        type: 'warning',
        field: 'diastolicBP',
        message: `Abnormal diastolic BP: ${vitals.diastolicBP} mmHg (Normal: ${ranges.diastolicBP.min}-${ranges.diastolicBP.max} mmHg)`,
      })
    }
  }

  // Heart Rate validation
  if (vitals.heartRate !== null && vitals.heartRate !== undefined) {
    if (vitals.heartRate <= ranges.heartRate.criticalLow || vitals.heartRate >= ranges.heartRate.criticalHigh) {
      alerts.push({
        type: 'critical',
        field: 'heartRate',
        message: `Critical heart rate: ${vitals.heartRate} bpm (Normal: ${ranges.heartRate.min}-${ranges.heartRate.max} bpm)`,
      })
    } else if (vitals.heartRate < ranges.heartRate.min || vitals.heartRate > ranges.heartRate.max) {
      alerts.push({
        type: 'warning',
        field: 'heartRate',
        message: `Abnormal heart rate: ${vitals.heartRate} bpm (Normal: ${ranges.heartRate.min}-${ranges.heartRate.max} bpm)`,
      })
    }
  }

  // Respiratory Rate validation
  if (vitals.respiratoryRate !== null && vitals.respiratoryRate !== undefined) {
    if (vitals.respiratoryRate <= ranges.respiratoryRate.criticalLow || vitals.respiratoryRate >= ranges.respiratoryRate.criticalHigh) {
      alerts.push({
        type: 'critical',
        field: 'respiratoryRate',
        message: `Critical respiratory rate: ${vitals.respiratoryRate}/min (Normal: ${ranges.respiratoryRate.min}-${ranges.respiratoryRate.max}/min)`,
      })
    } else if (vitals.respiratoryRate < ranges.respiratoryRate.min || vitals.respiratoryRate > ranges.respiratoryRate.max) {
      alerts.push({
        type: 'warning',
        field: 'respiratoryRate',
        message: `Abnormal respiratory rate: ${vitals.respiratoryRate}/min (Normal: ${ranges.respiratoryRate.min}-${ranges.respiratoryRate.max}/min)`,
      })
    }
  }

  // Oxygen Saturation validation
  if (vitals.oxygenSaturation !== null && vitals.oxygenSaturation !== undefined) {
    if (vitals.oxygenSaturation <= ranges.oxygenSaturation.criticalLow) {
      alerts.push({
        type: 'critical',
        field: 'oxygenSaturation',
        message: `Critical SpO2: ${vitals.oxygenSaturation}% (Normal: ${ranges.oxygenSaturation.min}-${ranges.oxygenSaturation.max}%)`,
      })
    } else if (vitals.oxygenSaturation < ranges.oxygenSaturation.min) {
      alerts.push({
        type: 'warning',
        field: 'oxygenSaturation',
        message: `Low SpO2: ${vitals.oxygenSaturation}% (Normal: ${ranges.oxygenSaturation.min}-${ranges.oxygenSaturation.max}%)`,
      })
    }
  }

  return alerts
}

/**
 * Check if vital signs contain critical values
 */
export function hasCriticalVitals(
  vitals: {
    temperature?: number | null
    systolicBP?: number | null
    diastolicBP?: number | null
    heartRate?: number | null
    respiratoryRate?: number | null
    oxygenSaturation?: number | null
  },
  ageYears: number | null
): boolean {
  const alerts = validateVitalSigns(vitals, ageYears)
  return alerts.some((alert) => alert.type === 'critical')
}

/**
 * Parse blood pressure string to get systolic and diastolic values
 */
export function parseBloodPressure(bp: string): { systolic: number | null; diastolic: number | null } {
  if (!bp) return { systolic: null, diastolic: null }
  const parts = bp.split(/[\/\-\s]+/)
  if (parts.length >= 2) {
    const sys = parseInt(parts[0], 10)
    const dia = parseInt(parts[1], 10)
    return { systolic: isNaN(sys) ? null : sys, diastolic: isNaN(dia) ? null : dia }
  }
  const nums = bp.match(/\d+/g)
  if (nums && nums.length >= 2) {
    return { systolic: parseInt(nums[0], 10), diastolic: parseInt(nums[1], 10) }
  }
  const single = parseInt(bp, 10)
  return { systolic: isNaN(single) ? null : single, diastolic: null }
}

/**
 * Extract numeric value from formatted vital sign string
 */
export function extractNumericValue(value: string): number | null {
  const match = value.match(/\d+(?:\.\d+)?/)
  return match ? parseFloat(match[0]) : null
}
