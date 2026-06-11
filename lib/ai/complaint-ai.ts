import { ComplaintCategory, ComplaintPriority, ComplaintTriageResult } from './types'

const CATEGORY_KEYWORDS: Record<ComplaintCategory, string[]> = {
  overpricing: [
    'overpric', 'too expensive', 'high price', 'price hike', 'unfair price',
    'costly', 'inflated', 'excessive', 'above market', 'price gouging',
    'daman beshi', 'dam beshi', 'oshombhob dam', 'beshi dam', 'mulyo beshi',
    'overcharge', 'price manipulation', 'unfair pricing', 'exorbitant',
  ],
  delivery_issue: [
    'delivery', 'not delivered', 'late delivery', 'damaged', 'broken',
    'missing', 'short delivery', 'wrong item', 'not received', 'delayed',
    'delivery problem', 'shipment issue', 'transport', 'logistics',
    'pouchein na', 'deri', 'derite', 'vongo', 'bhongo', 'shortage',
    'incomplete', 'partial delivery', 'wrong quantity',
  ],
  fraud: [
    'fraud', 'fake', 'scam', 'cheat', 'deceit', 'misrepresent',
    'false', 'counterfeit', 'forgery', 'manipulation', 'rigged',
    'corrupt', 'bribe', 'illegal', 'dishonest', 'deception',
    'protharon', 'jhol', 'dhoka', 'protaron', 'jhal', 'chor',
    'fraudulent', 'bogus', 'sham', 'hoax', 'trick', 'swindle',
  ],
  product_quality: [
    'quality', 'poor quality', 'bad quality', 'defective', 'spoiled',
    'rotten', 'moldy', 'contaminated', 'impure', 'low grade',
    'moisture', 'chita', 'damaged goods', 'inferior', 'substandard',
    'gungoto kom', 'kharap', 'nosto', 'podartho', 'moisture damage',
    'pest', 'insect', 'weevil', 'discoloration', 'smell', 'odor',
  ],
  other: [],
}

const HIGH_PRIORITY_KEYWORDS = [
  'urgent', 'emergency', 'immediate', 'critical', 'severe',
  'massive', 'widespread', 'systematic', 'repeated', 'multiple',
  'joruri', 'guruttor', 'atyo joruri', 'bishal', 'brihot',
  'threat', 'danger', 'harm', 'loss', 'damage', 'bankrupt',
]

const MEDIUM_PRIORITY_KEYWORDS = [
  'important', 'concern', 'issue', 'problem', 'trouble',
  'guruttopurno', 'shomossha', 'shondesh', 'bishoy',
  'recurring', 'ongoing', 'persistent', 'significant',
]

const FRAUD_INDICATORS = [
  'fraud', 'scam', 'cheat', 'fake', 'forgery', 'manipulation',
  'rigged', 'corrupt', 'bribe', 'collusion', 'conspiracy',
  'protharon', 'jhol', 'dhoka', 'protaron', 'chor', 'ghush',
  'systematic', 'organized', 'planned', 'deliberate', 'intentional',
  'price fixing', 'cartel', 'monopoly', 'hoarding', 'black market',
]

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function matchKeywords(text: string, keywords: string[]): string[] {
  const normalized = normalizeText(text)
  return keywords.filter(keyword => normalized.includes(keyword.toLowerCase()))
}

function determineCategory(text: string): { category: ComplaintCategory; confidence: number; keywords: string[] } {
  let bestCategory: ComplaintCategory = 'other'
  let bestScore = 0
  let bestKeywords: string[] = []

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'other') continue
    const matched = matchKeywords(text, keywords)
    if (matched.length > bestScore) {
      bestScore = matched.length
      bestCategory = category as ComplaintCategory
      bestKeywords = matched
    }
  }

  const confidence = Math.min(bestScore * 25, 100)
  return { category: bestCategory, confidence, keywords: bestKeywords }
}

function determinePriority(text: string): ComplaintPriority {
  const normalized = normalizeText(text)
  const highMatches = matchKeywords(normalized, HIGH_PRIORITY_KEYWORDS)
  const medMatches = matchKeywords(normalized, MEDIUM_PRIORITY_KEYWORDS)

  if (highMatches.length >= 2) return 'high'
  if (highMatches.length >= 1 || medMatches.length >= 2) return 'medium'
  return 'low'
}

function calculateFraudScore(text: string, category: ComplaintCategory): number {
  const normalized = normalizeText(text)
  let score = 0

  const fraudMatches = matchKeywords(normalized, FRAUD_INDICATORS)
  score += fraudMatches.length * 15

  if (category === 'fraud') score += 20
  if (category === 'overpricing') score += 10

  const length = text.length
  if (length > 500) score += 5
  if (length > 1000) score += 5

  const exclamationCount = (text.match(/!/g) || []).length
  score += Math.min(exclamationCount * 2, 10)

  const capsWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length
  score += Math.min(capsWords * 3, 10)

  return Math.min(Math.round(score), 100)
}

function generateSummary(
  text: string,
  category: ComplaintCategory,
  priority: ComplaintPriority,
  fraudScore: number
): string {
  const categoryLabels: Record<ComplaintCategory, string> = {
    overpricing: 'price-related grievance',
    delivery_issue: 'delivery/logistics complaint',
    fraud: 'suspected fraudulent activity',
    product_quality: 'product quality concern',
    other: 'general complaint',
  }

  const priorityLabels: Record<ComplaintPriority, string> = {
    high: 'high-priority',
    medium: 'medium-priority',
    low: 'low-priority',
  }

  let summary = `${priorityLabels[priority].charAt(0).toUpperCase() + priorityLabels[priority].slice(1)} ${categoryLabels[category]}`

  if (fraudScore >= 70) {
    summary += ' with strong indicators of fraudulent behavior'
  } else if (fraudScore >= 40) {
    summary += ' with moderate fraud risk signals'
  }

  const wordCount = text.split(/\s+/).length
  summary += `. Report contains ${wordCount} words.`

  return summary
}

function generateSuggestion(
  category: ComplaintCategory,
  priority: ComplaintPriority,
  fraudScore: number
): string {
  if (fraudScore >= 70) {
    return 'Escalate immediately to fraud investigation team. Freeze related transactions pending review. Collect documentary evidence from complainant.'
  }

  if (priority === 'high') {
    switch (category) {
      case 'overpricing':
        return 'Urgent: Review market prices in the reported area. Cross-reference with govt MSP and AI floor prices. Issue notice to accused mill if prices are found inflated.'
      case 'delivery_issue':
        return 'Urgent: Contact both parties immediately. Verify delivery records and transaction status. Arrange mediation between farmer and mill.'
      case 'fraud':
        return 'Urgent: Flag all related transactions. Suspend accused party pending investigation. Gather evidence from transaction logs and communication records.'
      case 'product_quality':
        return 'Urgent: Arrange quality inspection of the reported goods. Review quality grading records. Contact both parties for evidence submission.'
      default:
        return 'Urgent: Assign to senior admin for immediate review and action.'
    }
  }

  if (priority === 'medium') {
    switch (category) {
      case 'overpricing':
        return 'Review pricing data for the reported area. Compare with recent transactions and AI floor prices. Follow up with both parties within 48 hours.'
      case 'delivery_issue':
        return 'Check delivery status in transaction records. Contact mill for delivery update. Set 72-hour resolution deadline.'
      case 'fraud':
        return 'Review transaction history for patterns. Check if similar complaints exist against the same party. Schedule investigation within 1 week.'
      case 'product_quality':
        return 'Request quality inspection report. Review crop listing quality grade. Mediate between parties for fair resolution.'
      default:
        return 'Assign to admin for review within 5 business days.'
    }
  }

  return 'Log for review. Add to monthly complaint analysis report. Respond to complainant within 7 business days.'
}

export function triageComplaint(text: string): ComplaintTriageResult {
  if (!text || text.trim().length === 0) {
    return {
      category: 'other',
      priority: 'low',
      fraudScore: 0,
      summary: 'Empty complaint text provided.',
      suggestion: 'Request complainant to provide detailed description.',
      keywords: [],
    }
  }

  const { category, keywords } = determineCategory(text)
  const priority = determinePriority(text)
  const fraudScore = calculateFraudScore(text, category)
  const summary = generateSummary(text, category, priority, fraudScore)
  const suggestion = generateSuggestion(category, priority, fraudScore)

  return {
    category,
    priority,
    fraudScore,
    summary,
    suggestion,
    keywords,
  }
}

export function triageMultipleComplaints(
  complaints: Array<{ id: string; title: string; description: string }>
): Array<{ id: string; triage: ComplaintTriageResult }> {
  return complaints.map(c => ({
    id: c.id,
    triage: triageComplaint(`${c.title} ${c.description}`),
  }))
}
