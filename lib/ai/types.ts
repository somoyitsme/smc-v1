export type ComplaintCategory = 'overpricing' | 'delivery_issue' | 'fraud' | 'product_quality' | 'other'
export type ComplaintPriority = 'high' | 'medium' | 'low'
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'

export interface ComplaintTriageResult {
  category: ComplaintCategory
  priority: ComplaintPriority
  fraudScore: number
  summary: string
  suggestion: string
  keywords: string[]
}

export interface FraudDetectionResult {
  riskScore: number
  riskLevel: RiskLevel
  explanation: string
  suggestion: string
  flags: string[]
  factors: Record<string, number>
}

export interface ForecastPoint {
  date: string
  predicted: number
  lowerBound: number
  upperBound: number
  actual?: number
}

export interface DemandForecastResult {
  cropType: string
  variety: string
  district: string
  forecasts: ForecastPoint[]
  trend: 'increasing' | 'decreasing' | 'stable'
  trendPercent: number
  recommendation: string
  confidence: number
}

export interface AnalyticsInsight {
  id: string
  type: 'warning' | 'info' | 'success' | 'danger'
  title: string
  description: string
  metric?: string
  metricValue?: string
  trend?: 'up' | 'down' | 'stable'
  icon?: string
}

export interface FraudAlert {
  id: string
  targetType: 'user' | 'transaction' | 'mill' | 'complaint'
  targetId: string
  targetName: string
  riskScore: number
  riskLevel: RiskLevel
  reason: string
  suggestion: string
  detectedAt: string
}

export interface ForecastSummary {
  cropType: string
  currentDemand: number
  predictedDemand: number
  changePercent: number
  shortageRisk: boolean
  recommendation: string
}
