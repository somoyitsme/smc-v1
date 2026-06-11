import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/market - Public market board data
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // 1. Expose govt seasonal reference prices
    if (action === 'prices') {
      const prices = await prisma.govtPrice.findMany({
        orderBy: { effectiveFrom: 'desc' },
        take: 100,
      })
      return NextResponse.json(prices.map(p => ({
        id: p.id,
        variety: p.variety,
        season: p.season,
        pricePerMaund: Number(p.pricePer40kg),
        pricePerKg: Number(p.pricePerKg),
        source: p.source || 'DAM',
        effectiveFrom: p.effectiveFrom.toISOString(),
        effectiveTo: p.effectiveTo.toISOString()
      })))
    }

    // 2. Latest govt prices for key varieties (with comparison)
    if (action === 'latest-prices') {
      const varieties = ['BRRI dhan28', 'BRRI dhan29', 'Miniket', 'Nazirshail', 'BRRI dhan49', 'Chinigura']
      const latestPrices = await Promise.all(
        varieties.map(async (variety) => {
          const latest = await prisma.govtPrice.findFirst({
            where: { variety },
            orderBy: { effectiveFrom: 'desc' },
          })
          const current = latest ? Number(latest.pricePer40kg) : 0
          const previous = current
          return {
            variety,
            currentPrice: current,
            previousPrice: previous,
            change: 0,
            changePercent: 0,
            source: latest?.source || 'Department of Agricultural Marketing (DAM)',
            recordedAt: latest?.effectiveFrom || new Date()
          }
        })
      )
      return NextResponse.json(latestPrices)
    }

    // 3. Overall public statistics
    if (action === 'stats') {
      const [
        totalListings,
        activeListings,
        totalBids,
        completedDealsCount,
        totalFarmers,
        totalMills
      ] = await Promise.all([
        prisma.cropListing.count(),
        prisma.cropListing.count({ where: { status: 'active' } }),
        prisma.contactRequest.count(),
        prisma.transaction.count({ where: { deliveryStatus: 'confirmed' } }),
        prisma.user.count({ where: { role: 'farmer' } }),
        prisma.user.count({ where: { role: 'mill' } }),
      ])

      const transactions = await prisma.transaction.findMany({
        where: { deliveryStatus: 'confirmed' },
        select: { totalAmount: true, quantityKg: true },
      })
      
      const totalVolumeMaund = transactions.reduce((sum, t) => sum + (t.quantityKg / 40), 0)
      const totalValue = transactions.reduce((sum, t) => sum + Number(t.totalAmount), 0)

      return NextResponse.json({
        totalListings,
        activeListings,
        totalBids,
        completedDeals: completedDealsCount,
        totalVolume: Math.round(totalVolumeMaund),
        totalValue,
        totalFarmers,
        totalMills
      })
    }

    // 4. Anonymized completed transaction history
    if (action === 'recent-transactions') {
      const transactions = await prisma.transaction.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: {
          listing: {
            select: { locationDistrict: true },
          },
          mill: {
            include: { millProfile: true }
          }
        },
      })
      return NextResponse.json(transactions.map(t => ({
        id: t.id,
        cropType: t.cropType,
        variety: t.variety,
        quantity: t.quantityKg / 40, // Maunds
        agreedPrice: Number(t.agreedPrice),
        totalAmount: Number(t.totalAmount),
        createdAt: t.createdAt.toISOString(),
        millName: (t.mill as any)?.millProfile?.millName || 'Rice Mill Partner',
        district: t.listing?.locationDistrict || 'Bangladesh'
      })))
    }

    // 5. Mill processed inventory board
    if (action === 'inventories') {
      const inventories = await prisma.millInventory.findMany({
        where: { publicVisible: true },
        include: {
          mill: {
            include: { millProfile: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      })
      return NextResponse.json(inventories.map(inv => ({
        id: inv.id,
        millId: inv.millId,
        millName: (inv.mill as any)?.millProfile?.millName || inv.mill.name || 'Registered Rice Mill',
        riceType: inv.riceType,
        category: inv.category,
        quantityMaund: inv.quantityKg / 40,
        pricePerKg: Number(inv.pricePerKg),
        pricePerMaund: Number(inv.pricePerKg) * 40,
        availableFrom: inv.availableFrom.toISOString(),
        notes: inv.notes,
        updatedAt: inv.updatedAt.toISOString(),
        millTrustScore: inv.mill.trustScore
      })))
    }

    // 6. Mill profiles and trust rating scorecard
    if (action === 'mill-profiles') {
      const mills = await prisma.millProfile.findMany({
        include: {
          user: {
            include: {
              cardsAsMill: true
            }
          }
        }
      })
      return NextResponse.json(mills.map(m => ({
        id: m.id,
        millName: m.millName,
        capacityTon: m.capacityTon,
        trustScore: m.user.trustScore,
        yellowCards: m.user.cardsAsMill.filter(c => c.cardType === 'yellow' && !c.overridden).length,
        redCards: m.user.cardsAsMill.filter(c => c.cardType === 'red' && !c.overridden).length,
        greenCards: m.user.cardsAsMill.filter(c => c.cardType === 'green' && !c.overridden).length,
        suspended: m.suspended
      })))
    }

    // 7. Mill transaction history
    if (action === 'mill-transactions') {
      const millId = searchParams.get('millId')
      if (!millId) {
        return NextResponse.json({ error: 'Mill ID required' }, { status: 400 })
      }

      const transactions = await prisma.transaction.findMany({
        where: { millId },
        include: {
          farmer: {
            select: {
              name: true,
              district: true,
              phone: true
            }
          },
          listing: {
            select: {
              variety: true,
              quantityKg: true,
              cropType: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      })

      return NextResponse.json(transactions.map(t => ({
        id: t.id,
        farmerName: t.farmer.name,
        farmerDistrict: t.farmer.district,
        variety: t.listing.variety,
        cropType: t.listing.cropType,
        quantityKg: t.quantityKg,
        quantityMaund: t.quantityKg / 40,
        agreedPrice: Number(t.agreedPrice),
        totalAmount: Number(t.totalAmount),
        finalPrice: Number(t.finalPrice),
        paymentStatus: t.paymentStatus,
        deliveryStatus: t.deliveryStatus,
        priceRevised: t.priceRevised,
        createdAt: t.createdAt.toISOString()
      })))
    }

    return NextResponse.json({ error: 'Specify valid action parameter' }, { status: 400 })
  } catch (err: any) {
    console.error('Error GET /api/market:', err)
    return NextResponse.json({ error: 'Failed to fetch market data', details: err.message }, { status: 500 })
  }
}

// POST /api/market - Mill posts/updates processed rice inventory
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, millId, riceType, category, quantityKg, pricePerKg, notes } = body

    if (action === 'create-inventory') {
      const inventory = await prisma.millInventory.create({
        data: {
          millId,
          riceType,
          category,
          quantityKg: parseInt(quantityKg),
          pricePerKg: parseFloat(pricePerKg),
          availableFrom: new Date(),
          notes,
          publicVisible: true
        }
      })
      return NextResponse.json(inventory, { status: 201 })
    }

    if (action === 'delete-inventory') {
      const { id } = body
      await prisma.millInventory.delete({
        where: { id }
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    console.error('Error POST /api/market:', err)
    return NextResponse.json({ error: 'Failed to process inventory', details: err.message }, { status: 500 })
  }
}
