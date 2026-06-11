import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/bids - Get contact requests (formerly bids) filtered by listing, mill, or farmer
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const listingId = searchParams.get('listingId')
    const millId = searchParams.get('millId')
    const farmerId = searchParams.get('farmerId')

    const contactRequests = await prisma.contactRequest.findMany({
      where: {
        ...(listingId && { listingId }),
        ...(millId && { millId }),
        ...(farmerId && { farmerId }),
      },
      include: {
        listing: true,
        mill: {
          include: {
            millProfile: true
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Map to compatible format for frontend (as Bids)
    const mappedBids = contactRequests.map(cr => {
      const listingQuantity = cr.listing ? cr.listing.quantityKg / 40 : 50
      return {
        id: cr.id,
        listingId: cr.listingId,
        pricePerMaund: Number(cr.offeredPrice),
        totalPrice: Number(cr.offeredPrice) * listingQuantity,
        notes: cr.message,
        status: cr.status.toUpperCase(),
        createdAt: cr.createdAt.toISOString(),
        mill: {
          id: cr.millId,
          millName: (cr.mill.millProfile as any)?.millName || cr.mill.name || 'Mill Owner',
          rating: 5.0,
          totalDeals: (cr.mill.millProfile as any)?.completedDeals || 0,
          yellowCards: 0,
          user: {
            name: cr.mill.name || 'Mill Owner',
            nameBn: null
          }
        },
        messages: cr.messages.map(msg => ({
          id: msg.id,
          senderId: msg.senderId,
          senderRole: msg.senderRole,
          message: msg.message,
          priceOffered: msg.priceOffered ? Number(msg.priceOffered) : null,
          createdAt: msg.createdAt.toISOString()
        })),
        listing: cr.listing ? {
          variety: cr.listing.variety,
          quantity: listingQuantity,
          district: cr.listing.locationDistrict,
          status: cr.listing.status.toUpperCase(),
          aiFloorPrice: Number(cr.listing.aiFloorPrice)
        } : null
      }
    })

    return NextResponse.json(mappedBids)
  } catch (err: any) {
    console.error('Error GET /api/bids:', err)
    return NextResponse.json({ error: 'Failed to fetch contact requests', details: err.message }, { status: 500 })
  }
}

// POST /api/bids - Place a new contact request or send a negotiation message
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action } = body

    // Option A: Send a negotiation message in an active request chat
    if (action === 'send_message' || body.requestId) {
      const { requestId, senderId, senderRole, message, priceOffered } = body
      if (!requestId || !senderId || !senderRole || !message) {
        return NextResponse.json({ error: 'Missing required parameters for message' }, { status: 400 })
      }

      // Create negotiation message
      const msg = await prisma.negotiationMessage.create({
        data: {
          requestId,
          senderId,
          senderRole,
          message,
          priceOffered: priceOffered ? parseFloat(priceOffered) : null
        }
      })

      // If a new price is offered during negotiation, update status to negotiating and set new offered price
      if (priceOffered) {
        await prisma.contactRequest.update({
          where: { id: requestId },
          data: {
            offeredPrice: parseFloat(priceOffered),
            status: 'negotiating'
          }
        })
      }

      return NextResponse.json(msg, { status: 201 })
    }

    // Option B: Initiate new contact request (legacy bid placement flow)
    const { listingId, millId, pricePerMaund, notes, userId } = body
    if (!listingId || !millId || !pricePerMaund) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Validate listing is active
    const listing = await prisma.cropListing.findUnique({
      where: { id: listingId },
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.status.toLowerCase() !== 'active') {
      return NextResponse.json({ error: 'Listing is no longer active' }, { status: 400 })
    }

    // Validate floor price
    if (pricePerMaund < Number(listing.aiFloorPrice)) {
      return NextResponse.json(
        { 
          error: `Rejected: ৳${pricePerMaund}/মন is below the AI floor price of ৳${listing.aiFloorPrice}/মন.`,
          aiFloorPrice: Number(listing.aiFloorPrice),
        },
        { status: 400 }
      )
    }

    // Check if mill is suspended
    const mill = await prisma.millProfile.findUnique({
      where: { id: millId },
    })

    if (mill?.suspended) {
      return NextResponse.json(
        { error: 'Your mill account is currently suspended. Contact admin for details.' },
        { status: 403 }
      )
    }

    // Create the contact request
    const contactRequest = await prisma.contactRequest.create({
      data: {
        listingId,
        millId,
        farmerId: listing.farmerId,
        offeredPrice: pricePerMaund,
        message: notes,
        status: 'pending'
      },
      include: {
        mill: true
      }
    })

    // Log admin/system audit action
    await prisma.adminAction.create({
      data: {
        adminId: userId || millId,
        actionType: 'CONTACT_REQUEST_CREATED',
        targetType: 'listing',
        targetId: listingId,
        description: `Contact request placed by Mill ${millId} at price ৳${pricePerMaund}/maund`,
        afterValue: { offeredPrice: pricePerMaund }
      }
    }).catch(() => {})

    // Map to compatible format for frontend (as Bid)
    const responseBid = {
      id: contactRequest.id,
      listingId: contactRequest.listingId,
      pricePerMaund: Number(contactRequest.offeredPrice),
      totalPrice: Number(contactRequest.offeredPrice) * (listing.quantityKg / 40),
      notes: contactRequest.message,
      status: contactRequest.status.toUpperCase(),
      createdAt: contactRequest.createdAt.toISOString(),
      mill: {
        id: contactRequest.millId,
        millName: (mill as any)?.millName || contactRequest.mill.name || 'Mill Owner',
        rating: 5.0,
        totalDeals: (mill as any)?.completedDeals || 0,
        yellowCards: 0,
        user: { name: contactRequest.mill.name || 'Mill Owner' }
      }
    }

    return NextResponse.json(responseBid, { status: 201 })
  } catch (err: any) {
    console.error('Error POST /api/bids:', err)
    if (err.message && err.message.includes('below the AI-calculated fair floor')) {
      return NextResponse.json({ error: 'Your offer is below the AI-calculated fair floor for this crop.' }, { status: 400 })
    }
    if (err.message && err.message.includes('স্থগিত')) {
      return NextResponse.json({ error: 'এই মিলটি বর্তমানে স্থগিত।' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to place contact request', details: err.message }, { status: 500 })
  }
}

// PATCH /api/bids - Accept/reject or change status of a contact request
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { bidId, action, userId } = body

    const validActions = ['ACCEPTED', 'REJECTED', 'NEGOTIATING']
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const contactRequest = await prisma.contactRequest.findUnique({
      where: { id: bidId },
      include: { listing: true }
    })

    if (!contactRequest) {
      return NextResponse.json({ error: 'Contact request not found' }, { status: 404 })
    }

    const mappedStatus = action.toLowerCase() // 'accepted' | 'rejected' | 'negotiating'

    const updatedCr = await prisma.contactRequest.update({
      where: { id: bidId },
      data: { status: mappedStatus },
      include: {
        mill: true
      }
    })

    if (action === 'ACCEPTED') {
      // Outbid/reject all other pending requests for the same listing
      await prisma.contactRequest.updateMany({
        where: {
          listingId: contactRequest.listingId,
          id: { not: bidId },
          status: 'pending'
        },
        data: { status: 'rejected' }
      })

      // Update listing status
      await prisma.cropListing.update({
        where: { id: contactRequest.listingId },
        data: { status: 'sold' }
      })

      // Create final transaction
      const listing = contactRequest.listing
      const totalPrice = Number(contactRequest.offeredPrice) * (listing.quantityKg / 40)
      
      try {
        await prisma.transaction.create({
          data: {
            listingId: contactRequest.listingId,
            requestId: contactRequest.id,
            farmerId: contactRequest.farmerId,
            millId: contactRequest.millId,
            cropType: listing.cropType,
            variety: listing.variety,
            quantityKg: listing.quantityKg,
            agreedPrice: contactRequest.offeredPrice,
            totalAmount: totalPrice,
            paymentMethod: 'bkash',
            paymentStatus: 'pending',
            deliveryStatus: 'pending',
            finalPrice: contactRequest.offeredPrice
          }
        })
      } catch (txErr: any) {
        console.error('Failed to create transaction:', txErr)
        return NextResponse.json({ error: 'Failed to create transaction', details: txErr.message }, { status: 500 })
      }

      // Update farmer profile completed deals
      await prisma.farmerProfile.update({
        where: { id: contactRequest.farmerId },
        data: { completedDeals: { increment: 1 } }
      }).catch((err) => console.error('Failed to update farmer completed deals:', err))
    }

    // Return format compatible with legacy bid
    const responseCr = {
      id: updatedCr.id,
      listingId: updatedCr.listingId,
      pricePerMaund: Number(updatedCr.offeredPrice),
      status: updatedCr.status.toUpperCase(),
      createdAt: updatedCr.createdAt.toISOString()
    }

    return NextResponse.json(responseCr)
  } catch (err: any) {
    console.error('Error PATCH /api/bids:', err)
    return NextResponse.json({ error: 'Failed to update contact request', details: err.message }, { status: 500 })
  }
}
