import { AnalyticsInsight } from './types'

interface InsightInput {
  complaints: Array<{
    id: string
    district: string | null
    category: string
    status: string
    createdAt: Date
    aiFraudScore: number | null
  }>
  transactions: Array<{
    id: string
    agreedPrice: number
    finalPrice: number
    paymentStatus: string
    deliveryStatus: string
    priceRevised: boolean
    createdAt: Date
    farmerId: string
    millId: string
  }>
  mills: Array<{
    id: string
    millName: string
    trustScore: number
    suspended: boolean
    yellowCards: number
    totalDeals: number
  }>
  farmers: Array<{
    id: string
    name: string | null
    district: string | null
    totalListings: number
    completedDeals: number
    trustScore: number
  }>
  inventories: Array<{
    id: string
    riceType: string
    category: string
    quantityKg: number
    pricePerKg: number
    updatedAt: Date
  }>
  listings: Array<{
    id: string
    variety: string
    cropType: string
    quantityKg: number
    status: string
    district: string
    createdAt: Date
  }>
}

function analyzeComplaintDistricts(complaints: InsightInput['complaints']): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []

  if (complaints.length === 0) return insights

  const districtCounts: Record<string, number> = {}
  complaints.forEach(c => {
    const d = c.district || 'Unknown'
    districtCounts[d] = (districtCounts[d] || 0) + 1
  })

  const sorted = Object.entries(districtCounts).sort((a, b) => b[1] - a[1])
  const topDistrict = sorted[0]

  if (topDistrict) {
    insights.push({
      id: `insight-complaint-district-${Date.now()}`,
      type: topDistrict[1] > complaints.length * 0.3 ? 'danger' : 'warning',
      title: `Most Complained District`,
      description: `${topDistrict[0]} generated the highest number of complaints this period with ${topDistrict[1]} complaints (${Math.round(topDistrict[1] / complaints.length * 100)}% of total).`,
      metric: 'Top District',
      metricValue: topDistrict[0],
      trend: 'up',
    })
  }

  const fraudComplaints = complaints.filter(c => c.category === 'fraud')
  if (fraudComplaints.length > 0) {
    const fraudByDistrict: Record<string, number> = {}
    fraudComplaints.forEach(c => {
      const d = c.district || 'Unknown'
      fraudByDistrict[d] = (fraudByDistrict[d] || 0) + 1
    })
    const topFraudDistrict = Object.entries(fraudByDistrict).sort((a, b) => b[1] - a[1])[0]
    if (topFraudDistrict) {
      insights.push({
        id: `insight-fraud-district-${Date.now()}`,
        type: 'danger',
        title: `Fraud Complaint Hotspot`,
        description: `${topFraudDistrict[0]} has ${topFraudDistrict[1]} fraud-related complaints. Immediate investigation recommended.`,
        metric: 'Fraud Cases',
        metricValue: `${topFraudDistrict[1]}`,
        trend: 'up',
      })
    }
  }

  const pendingComplaints = complaints.filter(c => c.status === 'pending')
  if (pendingComplaints.length > complaints.length * 0.4) {
    insights.push({
      id: `insight-pending-complaints-${Date.now()}`,
      type: 'warning',
      title: `Complaint Backlog`,
      description: `${pendingComplaints.length} of ${complaints.length} complaints (${Math.round(pendingComplaints.length / complaints.length * 100)}%) are still pending review. Consider allocating more resources.`,
      metric: 'Pending',
      metricValue: `${pendingComplaints.length}`,
      trend: 'up',
    })
  }

  return insights
}

function analyzeInventoryShortages(inventories: InsightInput['inventories']): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []

  if (inventories.length === 0) {
    insights.push({
      id: `insight-no-inventory-${Date.now()}`,
      type: 'danger',
      title: 'No Inventory Data',
      description: 'No processed rice inventory data available. Mills may not be reporting stock levels.',
      metric: 'Status',
      metricValue: 'No Data',
    })
    return insights
  }

  const totalInventory = inventories.reduce((sum, inv) => sum + inv.quantityKg, 0)
  const lowStockItems = inventories.filter(inv => inv.quantityKg < 500)

  if (lowStockItems.length > 0) {
    insights.push({
      id: `insight-low-stock-${Date.now()}`,
      type: lowStockItems.length > inventories.length * 0.5 ? 'danger' : 'warning',
      title: 'Low Inventory Alert',
      description: `${lowStockItems.length} inventory items have less than 500 kg stock. ${lowStockItems.map(i => i.riceType).slice(0, 3).join(', ')} may run out soon.`,
      metric: 'Low Stock Items',
      metricValue: `${lowStockItems.length}`,
      trend: 'down',
    })
  }

  const categoryTotals: Record<string, number> = {}
  inventories.forEach(inv => {
    categoryTotals[inv.category] = (categoryTotals[inv.category] || 0) + inv.quantityKg
  })

  const lowestCategory = Object.entries(categoryTotals).sort((a, b) => a[1] - b[1])[0]
  if (lowestCategory && lowestCategory[1] < 2000) {
    insights.push({
      id: `insight-category-shortage-${Date.now()}`,
      type: 'warning',
      title: `${lowestCategory[0].charAt(0).toUpperCase() + lowestCategory[0].slice(1)} Rice Shortage`,
      description: `Total ${lowestCategory[0]} rice inventory is only ${lowestCategory[1]} kg across all mills. Supply chain bottleneck likely.`,
      metric: 'Total Stock',
      metricValue: `${lowestCategory[1]} kg`,
      trend: 'down',
    })
  }

  return insights
}

function analyzeSupplyChainBottlenecks(
  transactions: InsightInput['transactions'],
  listings: InsightInput['listings']
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []

  const pendingDeliveries = transactions.filter(t => t.deliveryStatus === 'pending')
  const pendingPayments = transactions.filter(t => t.paymentStatus === 'pending')

  if (pendingDeliveries.length > transactions.length * 0.3) {
    insights.push({
      id: `insight-delivery-bottleneck-${Date.now()}`,
      type: 'warning',
      title: 'Delivery Bottleneck',
      description: `${pendingDeliveries.length} of ${transactions.length} transactions (${Math.round(pendingDeliveries.length / transactions.length * 100)}%) have pending deliveries. Transport or logistics issues may be impacting the supply chain.`,
      metric: 'Pending Deliveries',
      metricValue: `${pendingDeliveries.length}`,
      trend: 'up',
    })
  }

  if (pendingPayments.length > transactions.length * 0.3) {
    insights.push({
      id: `insight-payment-bottleneck-${Date.now()}`,
      type: 'warning',
      title: 'Payment Delays',
      description: `${pendingPayments.length} transactions (${Math.round(pendingPayments.length / transactions.length * 100)}%) have pending payments. This may affect farmer trust and platform liquidity.`,
      metric: 'Pending Payments',
      metricValue: `${pendingPayments.length}`,
      trend: 'up',
    })
  }

  const revisedTransactions = transactions.filter(t => t.priceRevised)
  if (revisedTransactions.length > transactions.length * 0.2) {
    insights.push({
      id: `insight-price-revision-${Date.now()}`,
      type: 'warning',
      title: 'High Price Revision Rate',
      description: `${Math.round(revisedTransactions.length / transactions.length * 100)}% of deals had post-agreement price revisions. This indicates potential mill misconduct or market instability.`,
      metric: 'Revision Rate',
      metricValue: `${Math.round(revisedTransactions.length / transactions.length * 100)}%`,
      trend: 'up',
    })
  }

  const activeListings = listings.filter(l => l.status === 'active')
  if (activeListings.length < 5) {
    insights.push({
      id: `insight-low-listings-${Date.now()}`,
      type: 'info',
      title: 'Low Listing Activity',
      description: `Only ${activeListings.length} active crop listings on the platform. Consider outreach campaigns to increase farmer participation.`,
      metric: 'Active Listings',
      metricValue: `${activeListings.length}`,
      trend: 'down',
    })
  }

  return insights
}

function analyzeTopPerformers(
  farmers: InsightInput['farmers'],
  mills: InsightInput['mills']
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []

  const topFarmers = farmers
    .sort((a, b) => b.completedDeals - a.completedDeals)
    .slice(0, 3)

  if (topFarmers.length > 0 && topFarmers[0].completedDeals > 0) {
    insights.push({
      id: `insight-top-farmer-${Date.now()}`,
      type: 'success',
      title: 'Top Performing Farmer',
      description: `${topFarmers[0].name || 'Unknown'} from ${topFarmers[0].district || 'Unknown'} has completed ${topFarmers[0].completedDeals} deals with a trust score of ${topFarmers[0].trustScore}.`,
      metric: 'Deals',
      metricValue: `${topFarmers[0].completedDeals}`,
      trend: 'up',
    })
  }

  const topMills = mills
    .sort((a, b) => b.trustScore - a.trustScore)
    .filter(m => !m.suspended)
    .slice(0, 3)

  if (topMills.length > 0) {
    insights.push({
      id: `insight-top-mill-${Date.now()}`,
      type: 'success',
      title: 'Highest Trust Mill',
      description: `${topMills[0].millName} leads with a trust score of ${topMills[0].trustScore}/100 and ${topMills[0].totalDeals} total deals.`,
      metric: 'Trust Score',
      metricValue: `${topMills[0].trustScore}/100`,
      trend: 'up',
    })
  }

  const suspendedMills = mills.filter(m => m.suspended)
  if (suspendedMills.length > 0) {
    insights.push({
      id: `insight-suspended-mills-${Date.now()}`,
      type: suspendedMills.length > mills.length * 0.2 ? 'danger' : 'warning',
      title: 'Suspended Mills',
      description: `${suspendedMills.length} of ${mills.length} mills are currently suspended. ${suspendedMills.length > mills.length * 0.2 ? 'This is a high suspension rate — review governance policies.' : ''}`,
      metric: 'Suspended',
      metricValue: `${suspendedMills.length}/${mills.length}`,
      trend: 'down',
    })
  }

  return insights
}

function analyzeDemandTrends(
  transactions: InsightInput['transactions'],
  listings: InsightInput['listings']
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const recentTx = transactions.filter(t => new Date(t.createdAt) >= thirtyDaysAgo)
  const previousTx = transactions.filter(t => {
    const d = new Date(t.createdAt)
    return d >= sixtyDaysAgo && d < thirtyDaysAgo
  })

  if (previousTx.length > 0) {
    const growthRate = ((recentTx.length - previousTx.length) / previousTx.length) * 100
    if (growthRate > 10) {
      insights.push({
        id: `insight-demand-growth-${Date.now()}`,
        type: 'success',
        title: 'Demand Growing',
        description: `Transaction volume increased ${Math.round(growthRate)}% compared to the previous period (${recentTx.length} vs ${previousTx.length} transactions).`,
        metric: 'Growth',
        metricValue: `+${Math.round(growthRate)}%`,
        trend: 'up',
      })
    } else if (growthRate < -10) {
      insights.push({
        id: `insight-demand-decline-${Date.now()}`,
        type: 'warning',
        title: 'Demand Declining',
        description: `Transaction volume decreased ${Math.round(Math.abs(growthRate))}% compared to the previous period (${recentTx.length} vs ${previousTx.length} transactions).`,
        metric: 'Decline',
        metricValue: `${Math.round(growthRate)}%`,
        trend: 'down',
      })
    }
  }

  const varietyCounts: Record<string, number> = {}
  listings.forEach(l => {
    varietyCounts[l.variety] = (varietyCounts[l.variety] || 0) + 1
  })
  const topVariety = Object.entries(varietyCounts).sort((a, b) => b[1] - a[1])[0]
  if (topVariety) {
    insights.push({
      id: `insight-top-variety-${Date.now()}`,
      type: 'info',
      title: 'Most Listed Variety',
      description: `${topVariety[0]} is the most listed crop variety with ${topVariety[1]} listings.`,
      metric: 'Variety',
      metricValue: topVariety[0],
      trend: 'stable',
    })
  }

  return insights
}

export function generateInsights(input: InsightInput): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []

  insights.push(...analyzeComplaintDistricts(input.complaints))
  insights.push(...analyzeInventoryShortages(input.inventories))
  insights.push(...analyzeSupplyChainBottlenecks(input.transactions, input.listings))
  insights.push(...analyzeTopPerformers(input.farmers, input.mills))
  insights.push(...analyzeDemandTrends(input.transactions, input.listings))

  return insights
}
