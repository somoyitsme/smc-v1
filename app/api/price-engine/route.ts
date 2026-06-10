import { NextResponse } from 'next/server'
import { getAiPriceFloor } from '@/lib/ai-service'
import { getVarieties, getDistricts, getSeasons, getQualityGrades } from '@/lib/ai-price-engine'

// GET /api/price-engine - Calculate AI price floor
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'options') {
    return NextResponse.json({
      varieties: getVarieties(),
      districts: getDistricts(),
      seasons: getSeasons(),
      qualityGrades: getQualityGrades(),
    })
  }

  const variety = searchParams.get('variety')
  const season = searchParams.get('season')
  const qualityGrade = searchParams.get('qualityGrade')
  const district = searchParams.get('district')

  if (!variety || !season || !qualityGrade) {
    return NextResponse.json(
      { error: 'Required: variety, season, qualityGrade' },
      { status: 400 }
    )
  }

  const result = await getAiPriceFloor(
    variety,
    season,
    qualityGrade,
    district || 'Dinajpur' // default
  )

  return NextResponse.json(result)
}
