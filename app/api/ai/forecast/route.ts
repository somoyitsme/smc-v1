import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { forecastDemand, generateForecastSummaries, calculateInventoryRequirements } from '@/lib/ai'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'summaries') {
      const [transactions, inventories] = await Promise.all([
        prisma.transaction.findMany({
          orderBy: { createdAt: 'asc' },
        }),
        prisma.millInventory.findMany(),
      ])

      const txByMonth: Record<string, number[]> = {}
      transactions.forEach(t => {
        const month = t.createdAt.toISOString().slice(0, 7)
        if (!txByMonth[month]) txByMonth[month] = []
        txByMonth[month].push(Number(t.totalAmount))
      })

      const cropTypes = ['boro', 'aman', 'aus']
      const historicalDataByCrop: Record<string, Array<{ date: string; value: number }>> = {}

      cropTypes.forEach(crop => {
        const cropTransactions = transactions.filter(t => t.cropType === crop)
        const monthlyData: Record<string, number> = {}
        cropTransactions.forEach(t => {
          const month = t.createdAt.toISOString().slice(0, 7)
          monthlyData[month] = (monthlyData[month] || 0) + Number(t.totalAmount)
        })
        historicalDataByCrop[crop] = Object.entries(monthlyData)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({ date: `${date}-01`, value }))
      })

      const currentInventory: Record<string, number> = {}
      cropTypes.forEach(crop => {
        currentInventory[crop] = inventories
          .filter(inv => inv.riceType.toLowerCase().includes(crop))
          .reduce((sum, inv) => sum + inv.quantityKg, 0)
      })

      const summaries = generateForecastSummaries({
        cropTypes,
        historicalDataByCrop,
        currentInventory,
      })

      return NextResponse.json(summaries)
    }

    if (action === 'inventory-requirements') {
      const transactions = await prisma.transaction.findMany({
        orderBy: { createdAt: 'asc' },
      })

      const monthlyVolume: Record<string, number> = {}
      transactions.forEach(t => {
        const month = t.createdAt.toISOString().slice(0, 7)
        monthlyVolume[month] = (monthlyVolume[month] || 0) + t.quantityKg
      })

      const volumes = Object.values(monthlyVolume)
      const result = calculateInventoryRequirements({
        forecastedDemand: volumes,
        safetyStockDays: 7,
        leadTimeDays: 14,
      })

      return NextResponse.json(result)
    }

    const cropType = searchParams.get('cropType') || 'boro'
    const variety = searchParams.get('variety') || 'BRRI dhan28'
    const district = searchParams.get('district') || 'Dhaka'
    const months = parseInt(searchParams.get('months') || '6')

    const [demandHistory, transactions] = await Promise.all([
      prisma.demandHistory.findMany({
        where: { cropType, variety, district },
        orderBy: { recordedDate: 'asc' },
      }),
      prisma.transaction.findMany({
        where: { cropType },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    let historicalData: Array<{ date: string; value: number }>

    if (demandHistory.length > 0) {
      historicalData = demandHistory.map(d => ({
        date: d.recordedDate.toISOString().split('T')[0],
        value: d.demandQuantity,
      }))
    } else {
      const monthlyData: Record<string, number> = {}
      transactions.forEach(t => {
        const month = t.createdAt.toISOString().slice(0, 7)
        monthlyData[month] = (monthlyData[month] || 0) + t.quantityKg
      })
      historicalData = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date: `${date}-01`, value }))
    }

    const result = forecastDemand({
      cropType,
      variety,
      district,
      historicalData,
      forecastMonths: months,
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Error in forecast AI:', err)
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type } = body

    if (type === 'record-demand') {
      const { cropType, variety, district, recordedDate, demandQuantity, supplyQuantity, avgPrice, season } = body

      if (!cropType || !variety || !district || !recordedDate || demandQuantity === undefined) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      const record = await prisma.demandHistory.upsert({
        where: {
          cropType_variety_district_recordedDate: {
            cropType,
            variety,
            district,
            recordedDate: new Date(recordedDate),
          },
        },
        update: {
          demandQuantity,
          supplyQuantity: supplyQuantity || null,
          avgPrice: avgPrice || 0,
          season: season || null,
        },
        create: {
          cropType,
          variety,
          district,
          recordedDate: new Date(recordedDate),
          demandQuantity,
          supplyQuantity: supplyQuantity || null,
          avgPrice: avgPrice || 0,
          season: season || null,
        },
      })

      return NextResponse.json(record, { status: 201 })
    }

    return NextResponse.json({ error: 'Unknown action type' }, { status: 400 })
  } catch (err: any) {
    console.error('Error in forecast AI POST:', err)
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 })
  }
}
