import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

// GET /api/listings - Get all crop listings with filters
export async function GET(request: Request) {
  try {
    // Rule 5: Auto-expire active listings past their expiration time
    try {
      await prisma.cropListing.updateMany({
        where: {
          status: 'active',
          expiresAt: { lt: new Date() }
        },
        data: {
          status: 'expired'
        }
      })
    } catch (expErr) {
      console.error('Listing auto-expiry routine failed:', expErr)
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const variety = searchParams.get('variety')
    const cropType = searchParams.get('cropType') || searchParams.get('season')
    const district = searchParams.get('district')
    const farmerId = searchParams.get('farmerId')

    const listings = await prisma.cropListing.findMany({
      where: {
        ...(status && { status }),
        ...(variety && { variety }),
        ...(cropType && { cropType: cropType.toLowerCase() as any }),
        ...(district && { locationDistrict: district }),
        ...(farmerId && { farmerId }),
      },
      include: {
        farmer: {
          select: {
            id: true,
            name: true,
            phone: true,
            district: true,
            upazila: true,
            farmerProfile: true,
          },
        },
        contactRequests: {
          include: {
            mill: {
              select: {
                id: true,
                name: true,
                phone: true,
                trustScore: true,
                millProfile: true,
                cardsAsMill: true,
              },
            },
            messages: {
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { offeredPrice: 'desc' },
        },
        _count: { select: { contactRequests: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Map new Postgres structure to UI virtual fields for backward compatibility
    const mappedListings = listings.map(l => {
      // Map contactRequests to bids
      const mappedBids = l.contactRequests.map(cr => {
        const cards = cr.mill.cardsAsMill || []
        const greenCards = cards.filter((c: any) => c.cardType === 'green' && !c.overridden).length
        const yellowCards = cards.filter((c: any) => c.cardType === 'yellow' && !c.overridden).length
        const redCards = cards.filter((c: any) => c.cardType === 'red' && !c.overridden).length
        
        return {
          id: cr.id,
          listingId: cr.listingId,
          pricePerMaund: Number(cr.offeredPrice),
          totalPrice: Number(cr.offeredPrice) * (l.quantityKg / 40),
          notes: cr.message,
          transportIncluded: (cr.mill.millProfile as any)?.buyingPreferences?.transport_included || false,
          transportCost: null,
          status: cr.status.toUpperCase(),
          createdAt: cr.createdAt.toISOString(),
          mill: {
            id: cr.mill.id,
            millName: (cr.mill.millProfile as any)?.millName || cr.mill.name || 'Mill Owner',
            rating: (cr.mill.millProfile as any)?.rating || (cr.mill.trustScore / 20) || 5.0,
            totalDeals: (cr.mill.millProfile as any)?.totalDeals || 0,
            trustScore: cr.mill.trustScore,
            greenCards,
            yellowCards,
            redCards,
            user: { name: cr.mill.name, nameBn: null }
          },
          messages: cr.messages.map(msg => ({
            id: msg.id,
            senderId: msg.senderId,
            senderRole: msg.senderRole,
            message: msg.message,
            priceOffered: msg.priceOffered ? Number(msg.priceOffered) : null,
            createdAt: msg.createdAt.toISOString()
          }))
        }
      })

      return {
        id: l.id,
        variety: l.variety,
        season: l.cropType.toUpperCase(),
        quantity: Math.round(l.quantityKg / 40), // Convert kg to Maund for UI
        quantityKg: l.quantityKg,
        qualityGrade: l.qualityGrade,
        moisturePct: Number(l.moisturePct),
        chitaPct: Number(l.chitaPct),
        harvestDate: l.harvestDate ? l.harvestDate.toISOString() : null,
        availableDate: l.availableDate ? l.availableDate.toISOString() : null,
        description: '',
        aiFloorPrice: Number(l.aiFloorPrice),
        askingPrice: l.expectedMinPrice ? Number(l.expectedMinPrice) : null,
        expectedMinPrice: Number(l.expectedMinPrice),
        expectedMaxPrice: Number(l.expectedMaxPrice),
        govtRefPrice: Number(l.govtRefPrice),
        district: l.locationDistrict,
        upazila: l.locationUpazila,
        status: l.status.toLowerCase(),
        expiresAt: l.expiresAt.toISOString(),
        createdAt: l.createdAt.toISOString(),
        farmer: {
          id: l.farmer.id,
          district: l.farmer.district || 'Dinajpur',
          user: { name: l.farmer.name || 'Farmer', nameBn: null, phone: l.farmer.phone }
        },
        bids: mappedBids,
        contactRequests: l.contactRequests,
        _count: { bids: l._count.contactRequests, contactRequests: l._count.contactRequests }
      }
    })

    return NextResponse.json(mappedListings)
  } catch (err: any) {
    console.error('Error fetching listings:', err)
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 })
  }
}

// POST /api/listings - Create a new crop listing
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Enforce default values for missing new fields
    const quantityKg = body.quantityKg || (body.quantity ? Math.round(body.quantity * 40) : 2000)
    const cropType = (body.cropType || body.season?.toLowerCase() || 'boro') as any
    const qualityGrade = (body.qualityGrade || 'A') as any

    const listing = await prisma.cropListing.create({
      data: {
        farmerId: body.farmerId,
        cropType,
        variety: body.variety,
        quantityKg,
        qualityGrade,
        moisturePct: body.moisturePct || 14.0,
        chitaPct: body.chitaPct || 1.5,
        harvestDate: body.harvestDate ? new Date(body.harvestDate) : new Date(),
        availableDate: body.availableDate ? new Date(body.availableDate) : new Date(),
        locationDistrict: body.locationDistrict || body.district || 'Dinajpur',
        locationUpazila: body.locationUpazila || body.upazila || 'Birampur',
        expectedMinPrice: body.expectedMinPrice || body.askingPrice || 1200,
        expectedMaxPrice: body.expectedMaxPrice || (body.askingPrice ? body.askingPrice + 100 : 1300),
        aiFloorPrice: body.aiFloorPrice || 1200,
        govtRefPrice: body.govtRefPrice || 1100,
        status: 'active',
        expiresAt: new Date(body.expiresAt),
      },
      include: {
        farmer: {
          select: { name: true },
        },
      },
    })

    // Increment farmer total listings counter
    try {
      await prisma.farmerProfile.update({
        where: { id: body.farmerId },
        data: { totalListings: { increment: 1 } }
      })
    } catch { /* ignore profile updates if profile is not fully set up */ }

    // Write to audit log
    await logAudit({
      userId: body.userId || body.farmerId,
      action: 'LISTING_CREATED',
      entity: 'CropListing',
      entityId: listing.id,
      details: {
        variety: body.variety,
        quantityKg,
        aiFloorPrice: body.aiFloorPrice,
        cropType
      },
    })

    return NextResponse.json(listing, { status: 201 })
  } catch (err: any) {
    console.error('Error creating listing:', err)
    if (err.message && err.message.includes('নির্ধারিত ন্যূনতম মূল্যের নিচে')) {
      return NextResponse.json({ error: 'আপনার সর্বনিম্ন মূল্য AI-নির্ধারিত ন্যূনতম মূল্যের নিচে হতে পারবে না।' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create listing', details: err.message }, { status: 500 })
  }
}
