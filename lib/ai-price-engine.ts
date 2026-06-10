// ═══════════════════════════════════════════════════════════════
// KrishiDam — AI Price Floor Engine
// Calculates fair minimum prices for rice varieties
// ═══════════════════════════════════════════════════════════════

export interface PriceFloorInput {
  variety: string
  season: string
  qualityGrade: string
  district?: string
  quantity?: number
}

export interface PriceFloorResult {
  floorPrice: number        // ৳ per maund
  basePrice: number
  seasonFactor: number
  qualityFactor: number
  regionFactor: number
  supplyFactor: number
  confidence: number        // 0-100
  explanation: string
  breakdown: {
    label: string
    value: number
    impact: string
  }[]
}

// Government Minimum Support Prices (MSP) per maund — 2024-2025 data
const BASE_PRICES: Record<string, number> = {
  'BRRI dhan28': 1140,
  'BRRI dhan29': 1160,
  'BRRI dhan49': 1120,
  'BRRI dhan50': 1180,
  'BRRI dhan55': 1100,
  'BRRI dhan58': 1150,
  'BRRI dhan86': 1200,
  'BRRI dhan89': 1220,
  'Miniket': 1400,
  'Nazirshail': 1350,
  'Kataribhog': 1500,
  'Chinigura': 1650,
  'BR11': 1080,
  'BR22': 1060,
  'Swarna': 1100,
  'Hybrid (general)': 1050,
}

// Default for unknown varieties
const DEFAULT_BASE_PRICE = 1100

// Seasonal adjustment factors
const SEASON_FACTORS: Record<string, number> = {
  'BORO': 1.05,   // Boro is main season, slight premium for storage costs
  'AMAN': 1.00,   // Aman is baseline
  'AUS': 1.12,    // Aus is minor season, higher price due to scarcity
}

// Quality grade multipliers
const QUALITY_FACTORS: Record<string, number> = {
  'A': 1.15,  // Premium grade
  'B': 1.00,  // Standard grade
  'C': 0.85,  // Below standard
}

// Regional price adjustments (based on market access and transport costs)
const REGION_FACTORS: Record<string, number> = {
  // High market access (near Dhaka/ports)
  'Dhaka': 1.08,
  'Chittagong': 1.06,
  'Narayanganj': 1.07,
  'Gazipur': 1.06,
  'Comilla': 1.04,
  'Munshiganj': 1.05,
  
  // Major rice-producing districts
  'Dinajpur': 0.97,
  'Rangpur': 0.96,
  'Bogra': 0.98,
  'Rajshahi': 0.97,
  'Mymensingh': 1.00,
  'Sherpur': 0.98,
  'Jamalpur': 0.98,
  'Tangail': 1.01,
  'Jessore': 0.99,
  'Kushtia': 0.98,
  'Pabna': 0.99,
  
  // Remote/flood-prone areas (higher transport cost → lower farm-gate)
  'Sylhet': 0.95,
  'Sunamganj': 0.93,
  'Habiganj': 0.94,
  'Barisal': 0.95,
  'Patuakhali': 0.93,
  'Bhola': 0.92,
  'Khulna': 0.97,
  'Satkhira': 0.94,
  'Barguna': 0.93,
  
  // Char/haor areas
  'Netrokona': 0.95,
  'Kishoreganj': 0.97,
}

const DEFAULT_REGION_FACTOR = 0.98

// Supply adjustment (more listings = slight downward pressure)
function calculateSupplyFactor(currentListings?: number): number {
  if (!currentListings) return 1.0
  if (currentListings < 10) return 1.03  // Low supply premium
  if (currentListings < 50) return 1.00  // Normal
  if (currentListings < 100) return 0.98 // Slight pressure
  return 0.96                              // High supply
}

export function calculatePriceFloor(input: PriceFloorInput, currentListings?: number): PriceFloorResult {
  const basePrice = BASE_PRICES[input.variety] || DEFAULT_BASE_PRICE
  const seasonFactor = SEASON_FACTORS[input.season] || 1.0
  const qualityFactor = QUALITY_FACTORS[input.qualityGrade] || 1.0
  const regionFactor = input.district 
    ? (REGION_FACTORS[input.district] || DEFAULT_REGION_FACTOR)
    : DEFAULT_REGION_FACTOR
  const supplyFactor = calculateSupplyFactor(currentListings)

  const floorPrice = Math.round(
    basePrice * seasonFactor * qualityFactor * regionFactor * supplyFactor
  )

  // Calculate confidence based on data completeness
  let confidence = 70
  if (BASE_PRICES[input.variety]) confidence += 10
  if (input.district && REGION_FACTORS[input.district]) confidence += 10
  if (input.quantity && input.quantity > 0) confidence += 5
  confidence = Math.min(confidence, 95)

  const breakdown = [
    {
      label: `Base MSP (${input.variety || 'Unknown'})`,
      value: basePrice,
      impact: 'baseline',
    },
    {
      label: `Season (${input.season})`,
      value: seasonFactor,
      impact: seasonFactor > 1 ? `+${((seasonFactor - 1) * 100).toFixed(0)}%` : `${((seasonFactor - 1) * 100).toFixed(0)}%`,
    },
    {
      label: `Quality (Grade ${input.qualityGrade})`,
      value: qualityFactor,
      impact: qualityFactor > 1 ? `+${((qualityFactor - 1) * 100).toFixed(0)}%` : `${((qualityFactor - 1) * 100).toFixed(0)}%`,
    },
    {
      label: `Region (${input.district || 'Default'})`,
      value: regionFactor,
      impact: regionFactor > 1 ? `+${((regionFactor - 1) * 100).toFixed(0)}%` : `${((regionFactor - 1) * 100).toFixed(0)}%`,
    },
    {
      label: 'Supply Adjustment',
      value: supplyFactor,
      impact: supplyFactor > 1 ? `+${((supplyFactor - 1) * 100).toFixed(0)}%` : `${((supplyFactor - 1) * 100).toFixed(0)}%`,
    },
  ]

  const explanation = generateExplanation(input, floorPrice, basePrice, seasonFactor, qualityFactor, regionFactor)

  return {
    floorPrice,
    basePrice,
    seasonFactor,
    qualityFactor,
    regionFactor,
    supplyFactor,
    confidence,
    explanation,
    breakdown,
  }
}

function generateExplanation(
  input: PriceFloorInput,
  floorPrice: number,
  basePrice: number,
  seasonFactor: number,
  qualityFactor: number,
  regionFactor: number,
): string {
  const parts: string[] = []

  parts.push(`The AI-calculated fair price floor for ${input.variety} is ৳${floorPrice}/maund.`)
  parts.push(`This is based on the government MSP of ৳${basePrice}/maund.`)

  if (seasonFactor > 1) {
    parts.push(`${input.season} season adds a ${((seasonFactor - 1) * 100).toFixed(0)}% premium.`)
  }

  if (qualityFactor > 1) {
    parts.push(`Grade ${input.qualityGrade} quality adds a ${((qualityFactor - 1) * 100).toFixed(0)}% premium.`)
  } else if (qualityFactor < 1) {
    parts.push(`Grade ${input.qualityGrade} quality applies a ${((1 - qualityFactor) * 100).toFixed(0)}% reduction.`)
  }

  if (input.district) {
    if (regionFactor > 1) {
      parts.push(`${input.district} district has higher market access (+${((regionFactor - 1) * 100).toFixed(0)}%).`)
    } else if (regionFactor < 1) {
      parts.push(`${input.district} district's remoteness adjusts price by ${((regionFactor - 1) * 100).toFixed(0)}%.`)
    }
  }

  parts.push('No bid below this price will be accepted to protect farmer interests.')

  return parts.join(' ')
}

// Get all available varieties
export function getVarieties(): string[] {
  return Object.keys(BASE_PRICES)
}

// Get all available districts
export function getDistricts(): string[] {
  return Object.keys(REGION_FACTORS)
}

// Get seasons
export function getSeasons(): string[] {
  return Object.keys(SEASON_FACTORS)
}

// Get quality grades
export function getQualityGrades(): string[] {
  return Object.keys(QUALITY_FACTORS)
}
