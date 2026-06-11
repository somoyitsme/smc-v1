import { FraudDetectionResult, FraudAlert, RiskLevel } from './types'

interface TransactionData {
  id: string
  agreedPrice: number
  finalPrice: number
  totalAmount: number
  paymentStatus: string
  deliveryStatus: string
  priceRevised: boolean
  createdAt: Date
  farmerId: string
  millId: string
}

interface MillData {
  id: string
  millName: string
  trustScore: number
  yellowCards: number
  redCards: number
  suspended: boolean
  totalDeals: number
  completedDeals: number
}

interface PriceRevisionData {
  id: string
  originalPrice: number
  revisedPrice: number
  reason: string
  farmerDisputed: boolean
  adminReviewed: boolean
  millId: string
  createdAt: Date
}

interface ComplaintData {
  id: string
  title: string
  description: string
  category: string
  status: string
  aiFraudScore: number | null
  targetUserId: string | null
  createdAt: Date
}

function calculatePriceDeviation(agreedPrice: number, finalPrice: number): number {
  if (agreedPrice === 0) return 0
  return Math.abs((finalPrice - agreedPrice) / agreedPrice) * 100
}

function detectPriceManipulation(transactions: TransactionData[]): FraudDetectionResult {
  const flags: string[] = []
  const factors: Record<string, number> = {}
  let riskScore = 0

  const revisedTransactions = transactions.filter(t => t.priceRevised)
  const revisionRate = transactions.length > 0 ? revisedTransactions.length / transactions.length : 0

  factors['revisionRate'] = Math.round(revisionRate * 100)
  if (revisionRate > 0.3) {
    flags.push(`${Math.round(revisionRate * 100)}% of transactions had price revisions (threshold: 30%)`)
    riskScore += 25
  } else if (revisionRate > 0.15) {
    flags.push(`Elevated price revision rate: ${Math.round(revisionRate * 100)}%`)
    riskScore += 10
  }

  const avgDeviation = transactions.reduce((sum, t) => {
    return sum + calculatePriceDeviation(Number(t.agreedPrice), Number(t.finalPrice))
  }, 0) / Math.max(transactions.length, 1)

  factors['avgPriceDeviation'] = Math.round(avgDeviation)
  if (avgDeviation > 10) {
    flags.push(`Average price deviation is ${avgDeviation.toFixed(1)}% (threshold: 10%)`)
    riskScore += 20
  } else if (avgDeviation > 5) {
    flags.push(`Moderate average price deviation: ${avgDeviation.toFixed(1)}%`)
    riskScore += 10
  }

  const largeDeviations = transactions.filter(t => {
    const dev = calculatePriceDeviation(Number(t.agreedPrice), Number(t.finalPrice))
    return dev > 15
  })
  if (largeDeviations.length > 0) {
    flags.push(`${largeDeviations.length} transactions with >15% price deviation`)
    riskScore += largeDeviations.length * 5
  }

  const pendingPayments = transactions.filter(t => t.paymentStatus === 'pending')
  const pendingRate = transactions.length > 0 ? pendingPayments.length / transactions.length : 0
  factors['pendingPaymentRate'] = Math.round(pendingRate * 100)
  if (pendingRate > 0.4) {
    flags.push(`${Math.round(pendingRate * 100)}% of payments are pending (threshold: 40%)`)
    riskScore += 15
  }

  const pendingDeliveries = transactions.filter(t => t.deliveryStatus === 'pending')
  const pendingDeliveryRate = transactions.length > 0 ? pendingDeliveries.length / transactions.length : 0
  factors['pendingDeliveryRate'] = Math.round(pendingDeliveryRate * 100)
  if (pendingDeliveryRate > 0.4) {
    flags.push(`${Math.round(pendingDeliveryRate * 100)}% of deliveries are pending`)
    riskScore += 10
  }

  riskScore = Math.min(riskScore, 100)

  return {
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    explanation: flags.length > 0
      ? `Price manipulation analysis: ${flags.join('. ')}.`
      : 'No significant price manipulation patterns detected.',
    suggestion: riskScore >= 70
      ? 'Immediate investigation recommended. Freeze pending transactions and audit all recent deals.'
      : riskScore >= 40
        ? 'Monitor closely. Review recent transactions and contact involved parties.'
        : 'No action required. Continue standard monitoring.',
    flags,
    factors,
  }
}

function detectMillAnomalies(mill: MillData, revisions: PriceRevisionData[]): FraudDetectionResult {
  const flags: string[] = []
  const factors: Record<string, number> = {}
  let riskScore = 0

  factors['trustScore'] = mill.trustScore
  if (mill.trustScore < 50) {
    flags.push(`Very low trust score: ${mill.trustScore}/100`)
    riskScore += 30
  } else if (mill.trustScore < 70) {
    flags.push(`Below-average trust score: ${mill.trustScore}/100`)
    riskScore += 15
  }

  factors['yellowCards'] = mill.yellowCards
  factors['redCards'] = mill.redCards
  if (mill.yellowCards >= 3) {
    flags.push(`${mill.yellowCards} yellow cards (auto-suspension threshold: 3)`)
    riskScore += 20
  } else if (mill.yellowCards >= 2) {
    flags.push(`${mill.yellowCards} yellow cards issued`)
    riskScore += 10
  }
  if (mill.redCards > 0) {
    flags.push(`${mill.redCards} red card(s) on record`)
    riskScore += 25
  }

  const recentRevisions = revisions.filter(r => {
    const daysAgo = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    return daysAgo <= 30
  })
  factors['recentRevisions'] = recentRevisions.length
  if (recentRevisions.length >= 3) {
    flags.push(`${recentRevisions.length} price revisions in last 30 days`)
    riskScore += 15
  }

  const disputedRevisions = recentRevisions.filter(r => r.farmerDisputed)
  factors['disputedRevisions'] = disputedRevisions.length
  if (disputedRevisions.length >= 2) {
    flags.push(`${disputedRevisions.length} farmer-disputed revisions in 30 days`)
    riskScore += 20
  }

  const avgRevision = recentRevisions.length > 0
    ? recentRevisions.reduce((sum, r) => sum + Math.abs(Number(r.revisedPrice) - Number(r.originalPrice)), 0) / recentRevisions.length
    : 0
  factors['avgRevisionAmount'] = Math.round(avgRevision)
  if (avgRevision > 200) {
    flags.push(`Average price revision: ৳${avgRevision.toFixed(0)} (high)`)
    riskScore += 10
  }

  riskScore = Math.min(riskScore, 100)

  return {
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    explanation: flags.length > 0
      ? `Mill anomaly analysis for ${mill.millName}: ${flags.join('. ')}.`
      : `No anomalies detected for ${mill.millName}.`,
    suggestion: riskScore >= 70
      ? `Suspend ${mill.millName} immediately. Conduct full audit of all transactions.`
      : riskScore >= 40
        ? `Issue warning to ${mill.millName}. Increase monitoring frequency.`
        : `Continue standard monitoring for ${mill.millName}.`,
    flags,
    factors,
  }
}

function detectComplaintFraud(complaints: ComplaintData[]): FraudDetectionResult {
  const flags: string[] = []
  const factors: Record<string, number> = {}
  let riskScore = 0

  const highFraudComplaints = complaints.filter(c => (c.aiFraudScore ?? 0) >= 70)
  factors['highFraudComplaints'] = highFraudComplaints.length
  if (highFraudComplaints.length > 0) {
    flags.push(`${highFraudComplaints.length} complaints with fraud score >= 70`)
    riskScore += highFraudComplaints.length * 15
  }

  const fraudCategoryComplaints = complaints.filter(c => c.category === 'fraud')
  factors['fraudCategoryComplaints'] = fraudCategoryComplaints.length
  if (fraudCategoryComplaints.length >= 3) {
    flags.push(`${fraudCategoryComplaints.length} fraud-category complaints`)
    riskScore += 20
  }

  const unresolvedComplaints = complaints.filter(c => c.status === 'pending' || c.status === 'under_review')
  const unresolvedRate = complaints.length > 0 ? unresolvedComplaints.length / complaints.length : 0
  factors['unresolvedRate'] = Math.round(unresolvedRate * 100)
  if (unresolvedRate > 0.5 && complaints.length > 5) {
    flags.push(`${Math.round(unresolvedRate * 100)}% of complaints unresolved`)
    riskScore += 10
  }

  riskScore = Math.min(riskScore, 100)

  return {
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    explanation: flags.length > 0
      ? `Complaint fraud analysis: ${flags.join('. ')}.`
      : 'No suspicious complaint patterns detected.',
    suggestion: riskScore >= 70
      ? 'Launch fraud investigation. Cross-reference flagged complaints with transaction records.'
      : riskScore >= 40
        ? 'Review flagged complaints. Check for patterns across multiple complainants.'
        : 'Continue standard complaint processing.',
    flags,
    factors,
  }
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 35) return 'medium'
  return 'low'
}

export function analyzeFraudRisk(params: {
  transactions?: TransactionData[]
  mills?: MillData[]
  revisions?: PriceRevisionData[]
  complaints?: ComplaintData[]
}): {
  overall: FraudDetectionResult
  priceManipulation: FraudDetectionResult
  millAnomalies: Array<{ millId: string; millName: string; result: FraudDetectionResult }>
  complaintFraud: FraudDetectionResult
  alerts: FraudAlert[]
} {
  const { transactions = [], mills = [], revisions = [], complaints = [] } = params

  const priceManipulation = detectPriceManipulation(transactions)

  const millAnomalies = mills.map(mill => {
    const millRevisions = revisions.filter(r => r.millId === mill.id)
    return {
      millId: mill.id,
      millName: mill.millName,
      result: detectMillAnomalies(mill, millRevisions),
    }
  })

  const complaintFraud = detectComplaintFraud(complaints)

  const allScores = [
    priceManipulation.riskScore,
    ...millAnomalies.map(m => m.result.riskScore),
    complaintFraud.riskScore,
  ]
  const overallScore = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0

  const overall: FraudDetectionResult = {
    riskScore: overallScore,
    riskLevel: getRiskLevel(overallScore),
    explanation: `Overall fraud risk assessment across ${transactions.length} transactions, ${mills.length} mills, and ${complaints.length} complaints.`,
    suggestion: overallScore >= 70
      ? 'CRITICAL: Immediate action required. Activate fraud investigation protocol.'
      : overallScore >= 40
        ? 'Elevated risk detected. Increase monitoring and review flagged items.'
        : 'System operating within normal parameters. Continue standard monitoring.',
    flags: [
      ...priceManipulation.flags,
      ...millAnomalies.filter(m => m.result.riskScore >= 40).map(m => `${m.millName}: ${m.result.riskScore} risk score`),
      ...complaintFraud.flags,
    ],
    factors: {
      priceManipulation: priceManipulation.riskScore,
      millAnomalies: millAnomalies.filter(m => m.result.riskScore >= 40).length,
      complaintFraud: complaintFraud.riskScore,
    },
  }

  const alerts: FraudAlert[] = []

  if (priceManipulation.riskScore >= 40) {
    alerts.push({
      id: `alert-pm-${Date.now()}`,
      targetType: 'transaction',
      targetId: 'system',
      targetName: 'Price Manipulation',
      riskScore: priceManipulation.riskScore,
      riskLevel: priceManipulation.riskLevel,
      reason: priceManipulation.explanation,
      suggestion: priceManipulation.suggestion,
      detectedAt: new Date().toISOString(),
    })
  }

  millAnomalies.forEach(m => {
    if (m.result.riskScore >= 40) {
      alerts.push({
        id: `alert-mill-${m.millId}`,
        targetType: 'mill',
        targetId: m.millId,
        targetName: m.millName,
        riskScore: m.result.riskScore,
        riskLevel: m.result.riskLevel,
        reason: m.result.explanation,
        suggestion: m.result.suggestion,
        detectedAt: new Date().toISOString(),
      })
    }
  })

  if (complaintFraud.riskScore >= 40) {
    alerts.push({
      id: `alert-cf-${Date.now()}`,
      targetType: 'complaint',
      targetId: 'system',
      targetName: 'Complaint Fraud',
      riskScore: complaintFraud.riskScore,
      riskLevel: complaintFraud.riskLevel,
      reason: complaintFraud.explanation,
      suggestion: complaintFraud.suggestion,
      detectedAt: new Date().toISOString(),
    })
  }

  return { overall, priceManipulation, millAnomalies, complaintFraud, alerts }
}
