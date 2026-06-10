// ═══════════════════════════════════════════════════════════════
// KrishiDam — Python FastAPI AI Client Integration with Fallbacks
// ═══════════════════════════════════════════════════════════════

import { prisma } from './prisma'

const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8000'

export interface PriceFloorResult {
  floorPrice: number // Price per Maund (মন)
  govtReference: number
  marketMedian30d: number
  confidence: string
  explanation: string
  timestamp: string
  cached: boolean
}

export interface ForecastData {
  variety: string
  demandLevel: string
  activeBuyers: number
  competingListings: number
  recommendedAction: string
  explanation: string
}

export interface CropMatchResult {
  millId: string
  matchScore: number
  reason: string
}

// Helper to format timestamp
function getFormattedTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// 1. Fetch AI Price Floor from FastAPI service (with local cache & govt fallback)
export async function getAiPriceFloor(
  variety: string,
  season: string,
  qualityGrade: string,
  district: string,
  quantity?: number
): Promise<PriceFloorResult> {
  const cropType = season.toLowerCase()
  const quantityKg = quantity ? quantity * 40 : 2000

  // Check if FastAPI is configured and try calling it
  if (AI_SERVICE_URL && !AI_SERVICE_URL.includes('mock.fastapi.local')) {
    try {
      const res = await fetch(`${AI_SERVICE_URL}/price-floor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_type: cropType,
          variety,
          quality_grade: qualityGrade,
          moisture_pct: 13.8, // standard grade defaults
          chita_pct: 1.8,
          quantity_kg: quantityKg,
          district,
          harvest_date: new Date().toISOString().split('T')[0]
        }),
        signal: AbortSignal.timeout(4000) // 4s timeout for fast fallback
      })

      if (res.ok) {
        const data = await res.json()
        const floorPriceMaund = Math.round(data.floor_price_per_kg * 40)

        // Store result in local cache (valid for 6 hours)
        await prisma.priceFloorCache.create({
          data: {
            cropType,
            variety,
            qualityGrade,
            district,
            calculatedFloor: floorPriceMaund,
            factors: data,
            validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000)
          }
        }).catch(() => {})

        return {
          floorPrice: floorPriceMaund,
          govtReference: Math.round(data.govt_reference * 40),
          marketMedian30d: Math.round(data.market_median_30d * 40),
          confidence: data.confidence,
          explanation: data.explanation_bn,
          timestamp: `মূল্য সর্বশেষ আপডেট: ${getFormattedTime()} (সরাসরি AI)`,
          cached: false
        }
      }
    } catch (err) {
      console.warn('[AI Service] FastAPI Price Floor connection failed, triggering fallback cascade:', err)
    }
  }

  // FALLBACK CASCADE RULE
  // Step A: Search for the most recent cached entry for crop_type + variety + district
  try {
    const cachedEntry = await prisma.priceFloorCache.findFirst({
      where: {
        cropType,
        variety,
        district
      },
      orderBy: { createdAt: 'desc' }
    })

    if (cachedEntry) {
      const cacheFactors = cachedEntry.factors as any
      return {
        floorPrice: Number(cachedEntry.calculatedFloor),
        govtReference: cacheFactors?.govt_reference ? Math.round(cacheFactors.govt_reference * 40) : 1280,
        marketMedian30d: cacheFactors?.market_median_30d ? Math.round(cacheFactors.market_median_30d * 40) : 1200,
        confidence: 'medium',
        explanation: `সার্ভার সংযোগহীন। সংরক্ষিত ক্যাশ মূল্য ব্যবহৃত হচ্ছে। জাত: ${variety}, জেলা: ${district}।`,
        timestamp: `মূল্য সর্বশেষ আপডেট: ${getFormattedTime(cachedEntry.createdAt)} (সংরক্ষিত ক্যাশ)`,
        cached: true
      }
    }
  } catch (dbErr) {
    console.error('[AI Fallback] Failed reading cache from database:', dbErr)
  }

  // Step B: If no cache exists, fall back to govt_price * 0.92
  try {
    const govtPrice = await prisma.govtPrice.findFirst({
      where: { variety },
      orderBy: { createdAt: 'desc' }
    })

    if (govtPrice) {
      const fallbackPrice = Math.round(Number(govtPrice.pricePer40kg) * 0.92)
      return {
        floorPrice: fallbackPrice,
        govtReference: Number(govtPrice.pricePer40kg),
        marketMedian30d: Math.round(Number(govtPrice.pricePer40kg) * 0.90),
        confidence: 'low',
        explanation: `সার্ভার সংযোগহীন। সরকারি ন্যূনতম মূল্য (MSP) থেকে ৮% কমিয়ে প্রাক্কলিত এআই ফ্লোর নির্ধারিত।`,
        timestamp: `মূল্য সর্বশেষ আপডেট: ${getFormattedTime()} (সরকারি দামের ভিত্তি - ৯২%)`,
        cached: true
      }
    }
  } catch (dbErr) {
    console.error('[AI Fallback] Failed reading government reference rates:', dbErr)
  }

  // Step C: Absolute recovery fallback (static estimation)
  const defaultMsp = 1250
  const fallbackPrice = Math.round(defaultMsp * 0.92)
  return {
    floorPrice: fallbackPrice,
    govtReference: defaultMsp,
    marketMedian30d: defaultMsp * 0.90,
    confidence: 'low',
    explanation: `সার্ভার সংযোগহীন। এআই প্ল্যাটফর্ম ব্যাকআপ বেস ফ্লোর সক্রিয়।`,
    timestamp: `মূল্য সর্বশেষ আপডেট: ${getFormattedTime()} (সিস্টেম প্রাক্কলন)`,
    cached: true
  }
}

// 2. Fetch Demand Forecasting
export async function getDemandForecast(
  variety: string,
  season: string,
  district: string,
  quantity?: number
): Promise<ForecastData> {
  const cropType = season.toLowerCase()
  const quantityKg = quantity ? quantity * 40 : 2000

  if (AI_SERVICE_URL && !AI_SERVICE_URL.includes('mock.fastapi.local')) {
    try {
      const res = await fetch(`${AI_SERVICE_URL}/demand-forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_type: cropType,
          variety,
          district,
          quantity_kg: quantityKg
        }),
        signal: AbortSignal.timeout(4000)
      })
      if (res.ok) {
        const data = await res.json()
        return {
          variety,
          demandLevel: data.demand_level,
          activeBuyers: data.active_buyers,
          competingListings: data.competing_listings,
          recommendedAction: data.recommended_action,
          explanation: data.reasoning_bn
        }
      }
    } catch (err) {
      console.warn('[AI Service] FastAPI Demand Forecast failed, using simulation:', err)
    }
  }

  // Simulation fallback
  const demands: Record<string, number> = {
    'BRRI dhan28': 75,
    'BRRI dhan29': 82,
    'Miniket': 95,
    'Nazirshail': 90,
    'Chinigura': 65,
  }
  const index = demands[variety] || 70
  return {
    variety,
    demandLevel: index > 80 ? 'high' : 'moderate',
    activeBuyers: index > 80 ? 6 : 3,
    competingListings: 2,
    recommendedAction: index > 80 ? 'post_now' : 'post_now',
    explanation: `এই সপ্তাহে আপনার জেলায় ৩টি মিল সক্রিয়ভাবে চাল কিনতে ইচ্ছুক। এখনই পোস্ট করুন।`
  }
}

// 3. Fetch Crop Matching for Mills (Score and rank mills)
export async function getCropMatches(
  variety: string,
  season: string,
  district: string,
  quantity?: number
): Promise<CropMatchResult[]> {
  const cropType = season.toLowerCase()
  const quantityKg = quantity ? quantity * 40 : 2000

  if (AI_SERVICE_URL && !AI_SERVICE_URL.includes('mock.fastapi.local')) {
    try {
      const res = await fetch(`${AI_SERVICE_URL}/match-mills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_type: cropType,
          variety,
          district,
          moisture_pct: 14.0,
          quantity_kg: quantityKg
        }),
        signal: AbortSignal.timeout(4000)
      })
      if (res.ok) {
        const data = await res.json()
        return data.map((item: any) => ({
          millId: item.mill_id,
          matchScore: item.match_score,
          reason: item.reason_bn
        }))
      }
    } catch (err) {
      console.warn('[AI Service] FastAPI Crop Matching failed, using simulation:', err)
    }
  }

  // Simulation fallback
  return [
    {
      millId: '00000000-0000-0000-0000-000000000010',
      matchScore: 94,
      reason: 'নারায়ণগঞ্জের অটো চালকল আপনার জেলা দিনাজপুরের সাথে পরিবহন ও শস্য আর্দ্রতায় চমৎকার ম্যাচ করেছে।'
    },
    {
      millId: '00000000-0000-0000-0000-000000000011',
      matchScore: 88,
      reason: 'গাজীপুরের গ্রিন ভ্যালি রাইস যা আপনার BRRI dhan28 ধানের সর্বোচ্চ গ্রেড পছন্দ করে।'
    }
  ]
}
