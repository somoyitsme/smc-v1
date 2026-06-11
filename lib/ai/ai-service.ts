export { triageComplaint, triageMultipleComplaints } from './complaint-ai'
export { analyzeFraudRisk } from './fraud-ai'
export { forecastDemand, generateForecastSummaries, calculateInventoryRequirements } from './forecasting-ai'
export { generateInsights } from './analytics-ai'

export type {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintTriageResult,
  FraudDetectionResult,
  FraudAlert,
  RiskLevel,
  ForecastPoint,
  ForecastSummary,
  DemandForecastResult,
  AnalyticsInsight,
} from './types'

export const AI_VERSION = '1.0.0'

export function getRiskColor(level: string): string {
  switch (level) {
    case 'critical': return '#DC2626'
    case 'high': return '#F59E0B'
    case 'medium': return '#3B82F6'
    case 'low': return '#10B981'
    default: return '#6B7280'
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high': return '#DC2626'
    case 'medium': return '#F59E0B'
    case 'low': return '#10B981'
    default: return '#6B7280'
  }
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    overpricing: 'Overpricing',
    delivery_issue: 'Delivery Issue',
    fraud: 'Fraud',
    product_quality: 'Product Quality',
    other: 'Other',
  }
  return labels[category] || category
}

export function formatRiskScore(score: number): string {
  if (score >= 80) return `${score} (Critical)`
  if (score >= 60) return `${score} (High)`
  if (score >= 35) return `${score} (Medium)`
  return `${score} (Low)`
}
