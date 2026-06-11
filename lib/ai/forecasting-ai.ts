import { DemandForecastResult, ForecastPoint, ForecastSummary } from './types'

interface HistoricalDataPoint {
  date: string
  value: number
}

function movingAverage(data: number[], windowSize: number): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      result.push(data[i])
    } else {
      const window = data.slice(i - windowSize + 1, i + 1)
      const avg = window.reduce((sum, val) => sum + val, 0) / windowSize
      result.push(avg)
    }
  }
  return result
}

function weightedMovingAverage(data: number[], windowSize: number): number[] {
  const result: number[] = []
  const weights = Array.from({ length: windowSize }, (_, i) => i + 1)
  const weightSum = weights.reduce((a, b) => a + b, 0)

  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      result.push(data[i])
    } else {
      const window = data.slice(i - windowSize + 1, i + 1)
      const weightedSum = window.reduce((sum, val, idx) => sum + val * weights[idx], 0)
      result.push(weightedSum / weightSum)
    }
  }
  return result
}

function linearRegression(data: number[]): { slope: number; intercept: number; r2: number } {
  const n = data.length
  if (n < 2) return { slope: 0, intercept: data[0] || 0, r2: 0 }

  const xMean = (n - 1) / 2
  const yMean = data.reduce((a, b) => a + b, 0) / n

  let numerator = 0
  let denominator = 0
  let ssTotal = 0
  let ssResidual = 0

  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (data[i] - yMean)
    denominator += (i - xMean) * (i - xMean)
    ssTotal += (data[i] - yMean) * (data[i] - yMean)
  }

  const slope = denominator !== 0 ? numerator / denominator : 0
  const intercept = yMean - slope * xMean

  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept
    ssResidual += (data[i] - predicted) * (data[i] - predicted)
  }

  const r2 = ssTotal !== 0 ? 1 - ssResidual / ssTotal : 0

  return { slope, intercept, r2 }
}

function calculateConfidence(data: number[], r2: number): number {
  if (data.length < 3) return 40
  if (data.length < 6) return 55

  const cv = calculateCoefficientOfVariation(data)
  let confidence = 70

  if (r2 > 0.8) confidence += 15
  else if (r2 > 0.6) confidence += 10
  else if (r2 > 0.4) confidence += 5

  if (cv < 0.1) confidence += 10
  else if (cv < 0.2) confidence += 5
  else if (cv > 0.5) confidence -= 10

  if (data.length > 12) confidence += 5

  return Math.min(Math.max(Math.round(confidence), 20), 95)
}

function calculateCoefficientOfVariation(data: number[]): number {
  if (data.length === 0) return 0
  const mean = data.reduce((a, b) => a + b, 0) / data.length
  if (mean === 0) return 0
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length
  return Math.sqrt(variance) / Math.abs(mean)
}

function detectTrend(slope: number, avgValue: number): { trend: 'increasing' | 'decreasing' | 'stable'; percent: number } {
  if (avgValue === 0) return { trend: 'stable', percent: 0 }
  const percentChange = (slope / avgValue) * 100

  if (percentChange > 2) return { trend: 'increasing', percent: Math.round(percentChange * 10) / 10 }
  if (percentChange < -2) return { trend: 'decreasing', percent: Math.round(Math.abs(percentChange) * 10) / 10 }
  return { trend: 'stable', percent: Math.round(Math.abs(percentChange) * 10) / 10 }
}

function generateForecast(
  historicalData: HistoricalDataPoint[],
  forecastPeriods: number,
  method: 'ma' | 'wma' | 'lr' = 'lr'
): ForecastPoint[] {
  if (historicalData.length === 0) return []

  const values = historicalData.map(d => d.value)
  const lastDate = new Date(historicalData[historicalData.length - 1].date)

  let smoothedValues: number[]
  let forecastValues: number[]

  switch (method) {
    case 'ma':
      smoothedValues = movingAverage(values, Math.min(3, values.length))
      forecastValues = Array(forecastPeriods).fill(smoothedValues[smoothedValues.length - 1])
      break
    case 'wma':
      smoothedValues = weightedMovingAverage(values, Math.min(3, values.length))
      forecastValues = Array(forecastPeriods).fill(smoothedValues[smoothedValues.length - 1])
      break
    case 'lr':
    default: {
      const regression = linearRegression(values)
      forecastValues = []
      for (let i = 0; i < forecastPeriods; i++) {
        const x = values.length + i
        forecastValues.push(Math.max(0, regression.slope * x + regression.intercept))
      }
      smoothedValues = values
      break
    }
  }

  const stdDev = Math.sqrt(
    values.reduce((sum, val) => sum + Math.pow(val - values.reduce((a, b) => a + b, 0) / values.length, 2), 0) / values.length
  )

  const forecasts: ForecastPoint[] = forecastValues.map((value, i) => {
    const forecastDate = new Date(lastDate)
    forecastDate.setDate(forecastDate.getDate() + (i + 1) * 30)

    const uncertainty = stdDev * (1 + i * 0.3)

    return {
      date: forecastDate.toISOString().split('T')[0],
      predicted: Math.round(Math.max(0, value)),
      lowerBound: Math.round(Math.max(0, value - uncertainty * 1.96)),
      upperBound: Math.round(value + uncertainty * 1.96),
    }
  })

  return forecasts
}

export function forecastDemand(params: {
  cropType: string
  variety: string
  district: string
  historicalData: HistoricalDataPoint[]
  forecastMonths?: number
}): DemandForecastResult {
  const { cropType, variety, district, historicalData, forecastMonths = 6 } = params

  if (historicalData.length === 0) {
    return {
      cropType,
      variety,
      district,
      forecasts: [],
      trend: 'stable',
      trendPercent: 0,
      recommendation: 'Insufficient historical data for forecasting. Collect at least 3 months of data.',
      confidence: 20,
    }
  }

  const values = historicalData.map(d => d.value)
  const regression = linearRegression(values)
  const { trend, percent: trendPercent } = detectTrend(regression.slope, values.reduce((a, b) => a + b, 0) / values.length)
  const confidence = calculateConfidence(values, regression.r2)

  const maForecasts = generateForecast(historicalData, forecastMonths, 'ma')
  const wmaForecasts = generateForecast(historicalData, forecastMonths, 'wma')
  const lrForecasts = generateForecast(historicalData, forecastMonths, 'lr')

  const ensembleForecasts: ForecastPoint[] = lrForecasts.map((lr, i) => {
    const ma = maForecasts[i]
    const wma = wmaForecasts[i]

    const ensemblePredicted = (lr.predicted * 0.5 + ma.predicted * 0.2 + wma.predicted * 0.3)
    const ensembleLower = Math.min(lr.lowerBound, ma.lowerBound, wma.lowerBound)
    const ensembleUpper = Math.max(lr.upperBound, ma.upperBound, wma.upperBound)

    return {
      date: lr.date,
      predicted: Math.round(ensemblePredicted),
      lowerBound: ensembleLower,
      upperBound: ensembleUpper,
    }
  })

  const historicalWithForecast: ForecastPoint[] = [
    ...historicalData.map(d => ({
      date: d.date,
      predicted: d.value,
      lowerBound: d.value,
      upperBound: d.value,
      actual: d.value,
    })),
    ...ensembleForecasts,
  ]

  let recommendation: string
  if (trend === 'increasing' && trendPercent > 5) {
    recommendation = `Demand for ${variety} ${cropType} in ${district} is rising ${trendPercent}% per period. Increase procurement and storage capacity. Consider incentivizing farmers for this variety.`
  } else if (trend === 'decreasing' && trendPercent > 5) {
    recommendation = `Demand for ${variety} ${cropType} in ${district} is declining ${trendPercent}% per period. Reduce procurement targets. Consider shifting focus to higher-demand varieties.`
  } else if (trend === 'increasing') {
    recommendation = `Steady demand growth for ${variety} ${cropType}. Maintain current procurement levels with slight upward adjustment.`
  } else if (trend === 'decreasing') {
    recommendation = `Slight demand decline for ${variety} ${cropType}. Monitor closely and adjust procurement accordingly.`
  } else {
    recommendation = `Stable demand for ${variety} ${cropType} in ${district}. Continue current procurement strategy.`
  }

  return {
    cropType,
    variety,
    district,
    forecasts: historicalWithForecast,
    trend,
    trendPercent,
    recommendation,
    confidence,
  }
}

export function generateForecastSummaries(params: {
  cropTypes: string[]
  historicalDataByCrop: Record<string, HistoricalDataPoint[]>
  currentInventory: Record<string, number>
}): ForecastSummary[] {
  const { cropTypes, historicalDataByCrop, currentInventory } = params

  return cropTypes.map(cropType => {
    const data = historicalDataByCrop[cropType] || []
    const values = data.map(d => d.value)
    const currentDemand = values.length > 0 ? values[values.length - 1] : 0

    const regression = linearRegression(values)
    const nextPeriodPredicted = regression.slope * values.length + regression.intercept
    const predictedDemand = Math.max(0, Math.round(nextPeriodPredicted))

    const changePercent = currentDemand > 0
      ? Math.round(((predictedDemand - currentDemand) / currentDemand) * 1000) / 10
      : 0

    const inventory = currentInventory[cropType] || 0
    const daysOfSupply = predictedDemand > 0 ? Math.round((inventory / predictedDemand) * 30) : 999
    const shortageRisk = daysOfSupply < 15

    let recommendation: string
    if (shortageRisk) {
      recommendation = `URGENT: ${cropType} inventory may run out within ${daysOfSupply} days. Increase procurement immediately.`
    } else if (changePercent > 10) {
      recommendation = `Demand for ${cropType} expected to rise ${changePercent}%. Increase procurement targets.`
    } else if (changePercent < -10) {
      recommendation = `Demand for ${cropType} expected to decline ${Math.abs(changePercent)}%. Reduce procurement.`
    } else {
      recommendation = `${cropType} demand stable. Maintain current procurement levels.`
    }

    return {
      cropType,
      currentDemand,
      predictedDemand,
      changePercent,
      shortageRisk,
      recommendation,
    }
  })
}

export function calculateInventoryRequirements(params: {
  forecastedDemand: number[]
  safetyStockDays: number
  leadTimeDays: number
}): { reorderPoint: number; safetyStock: number; economicOrderQty: number } {
  const { forecastedDemand, safetyStockDays = 7, leadTimeDays = 14 } = params

  const avgDailyDemand = forecastedDemand.length > 0
    ? forecastedDemand.reduce((a, b) => a + b, 0) / forecastedDemand.length / 30
    : 0

  const safetyStock = Math.round(avgDailyDemand * safetyStockDays)
  const reorderPoint = Math.round(avgDailyDemand * leadTimeDays + safetyStock)
  const economicOrderQty = Math.round(avgDailyDemand * 60)

  return { reorderPoint, safetyStock, economicOrderQty }
}
