import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/admin - Admin dashboard stats, audit logs, mills list, price floors, and disputes
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'stats') {
      const [
        totalUsers,
        totalFarmers,
        totalMills,
        activeListings,
        totalRequests,
        completedTransactions,
        adminActionsCount,
        recentActions,
        disputesCount
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'farmer' } }),
        prisma.user.count({ where: { role: 'mill' } }),
        prisma.cropListing.count({ where: { status: 'active' } }),
        prisma.contactRequest.count(),
        prisma.transaction.count({ where: { deliveryStatus: 'confirmed' } }),
        prisma.adminAction.count(),
        prisma.adminAction.findMany({
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            admin: { select: { name: true, role: true } }
          }
        }),
        prisma.priceRevision.count({ where: { farmerDisputed: true, adminReviewed: false } })
      ])

      // Calculate total revenue from confirmed deals
      const transactions = await prisma.transaction.findMany({
        where: { deliveryStatus: 'confirmed' },
        select: { totalAmount: true }
      })
      const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.totalAmount), 0)

      // Map format for compatibility with UI
      return NextResponse.json({
        totalUsers,
        totalFarmers,
        totalMills,
        activeListings,
        totalBids: totalRequests,
        completedTransactions,
        totalRevenue,
        auditCount: adminActionsCount,
        recentAudit: recentActions.map(act => ({
          id: act.id,
          userId: act.adminId,
          action: act.actionType,
          entity: act.targetType,
          entityId: act.targetId,
          details: act.description,
          createdAt: act.createdAt.toISOString(),
          user: act.admin
        })),
        adminActions: recentActions.slice(0, 10).map(act => ({
          id: act.id,
          type: act.actionType,
          reason: act.description,
          createdAt: act.createdAt.toISOString(),
          actionBy: act.admin,
          actionOn: { name: 'System Target', role: act.targetType }
        })),
        disputesCount
      })
    }

    if (action === 'audit') {
      const limit = parseInt(searchParams.get('limit') || '50')
      const actions = await prisma.adminAction.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { name: true, role: true } } }
      })
      return NextResponse.json(actions.map(act => ({
        id: act.id,
        userId: act.adminId,
        action: act.actionType,
        entity: act.targetType,
        entityId: act.targetId,
        details: act.description,
        createdAt: act.createdAt.toISOString(),
        user: act.admin
      })))
    }

    if (action === 'mills') {
      const mills = await prisma.millProfile.findMany({
        include: {
          user: { select: { name: true, phone: true, verified: true, trustScore: true } }
        }
      })
      return NextResponse.json(mills.map(m => ({
        id: m.id,
        userId: m.id,
        millName: m.millName,
        binNumber: m.binNumber,
        licenseNumber: m.licenseNumber,
        capacityTon: m.capacityTon,
        publicVisible: m.publicVisible,
        isSuspended: m.suspended,
        suspensionReason: m.suspensionReason,
        user: {
          name: m.user.name,
          phone: m.user.phone,
          isActive: m.user.verified,
          trustScore: m.user.trustScore,
          yellowCards: 0 // Will query cards separately or compute
        }
      })))
    }

    if (action === 'price-floors') {
      const govtPrices = await prisma.govtPrice.findMany({
        orderBy: { createdAt: 'desc' }
      })
      
      // Get unique varieties (latest price per variety+season)
      const uniquePrices = new Map()
      govtPrices.forEach(gp => {
        const key = `${gp.variety}_${gp.season}`
        if (!uniquePrices.has(key)) {
          uniquePrices.set(key, gp)
        }
      })
      
      // Map back to compatible AI floor price structures for dashboard
      return NextResponse.json(Array.from(uniquePrices.values()).map(gp => ({
        id: gp.id,
        variety: gp.variety,
        season: gp.season,
        floorPrice: Number(gp.pricePer40kg),
        adminOverride: Number(gp.pricePer40kg),
        effectiveFrom: gp.effectiveFrom.toISOString(),
        effectiveTo: gp.effectiveTo.toISOString(),
        updatedAt: gp.updatedAt ? gp.updatedAt.toISOString() : gp.createdAt.toISOString()
      })))
    }

    if (action === 'disputes') {
      const disputes = await prisma.priceRevision.findMany({
        where: { farmerDisputed: true },
        include: {
          transaction: {
            include: {
              farmer: { select: { name: true, phone: true } },
              mill: { select: { name: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
      return NextResponse.json(disputes)
    }

    if (action === 'cards') {
      const cards = await prisma.millCard.findMany({
        include: {
          mill: {
            select: {
              name: true,
              millProfile: { select: { millName: true } }
            }
          },
          issuer: { select: { name: true } },
          overrider: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
      return NextResponse.json(cards)
    }

    // Platform settings (monetization configuration)
    if (action === 'settings') {
      const settings = await prisma.platformSettings.findMany({
        include: { updater: { select: { name: true } } }
      })
      return NextResponse.json(settings.map(s => ({
        key: s.key,
        value: s.value,
        description: s.description,
        updatedBy: s.updater?.name || 'System',
        updatedAt: s.updatedAt.toISOString()
      })))
    }

    // Analytics data for charts
    if (action === 'analytics') {
      // Transaction volume by month (last 6 months)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      const allTransactions = await prisma.transaction.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { agreedPrice: true, totalAmount: true, variety: true, createdAt: true, deliveryStatus: true }
      })

      // Group by month
      const monthlyData: Record<string, { count: number; volume: number; revenue: number }> = {}
      for (const tx of allTransactions) {
        const monthKey = tx.createdAt.toISOString().slice(0, 7) // YYYY-MM
        if (!monthlyData[monthKey]) monthlyData[monthKey] = { count: 0, volume: 0, revenue: 0 }
        monthlyData[monthKey].count++
        monthlyData[monthKey].volume += Number(tx.totalAmount)
        // Platform revenue = 0.5% of total amount
        monthlyData[monthKey].revenue += Number(tx.totalAmount) * 0.005
      }

      const transactionsByMonth = Object.entries(monthlyData)
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month))

      // Mill compliance scores (top 10)
      const mills = await prisma.millProfile.findMany({
        include: {
          user: {
            select: { name: true, trustScore: true },
            include: { cardsAsMill: { where: { overridden: false } } }
          }
        },
        take: 10
      })

      const millCompliance = mills.map(m => ({
        millName: m.millName,
        trustScore: (m.user as any).trustScore,
        yellowCards: (m.user as any).cardsAsMill.filter((c: any) => c.cardType === 'yellow').length,
        redCards: (m.user as any).cardsAsMill.filter((c: any) => c.cardType === 'red').length,
        suspended: m.suspended
      }))

      // Price trend per variety
      const priceTrends: Record<string, { date: string; price: number }[]> = {}
      for (const tx of allTransactions) {
        if (!priceTrends[tx.variety]) priceTrends[tx.variety] = []
        priceTrends[tx.variety].push({
          date: tx.createdAt.toISOString().split('T')[0],
          price: Number(tx.agreedPrice)
        })
      }

      return NextResponse.json({
        transactionsByMonth,
        millCompliance,
        priceTrends,
        totalTransactions: allTransactions.length,
        totalVolume: allTransactions.reduce((s, t) => s + Number(t.totalAmount), 0),
        platformRevenue: allTransactions.reduce((s, t) => s + Number(t.totalAmount) * 0.005, 0)
      })
    }

    return NextResponse.json({ error: 'Specify valid action parameter' }, { status: 400 })
  } catch (err: any) {
    console.error('Error GET /api/admin:', err)
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 })
  }
}

// POST /api/admin - Admin actions (yellow/red card, price override, dispute ruling)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, adminId, targetUserId, reason } = body

    // 1. Issuing cards
    if (type === 'YELLOW_CARD' || type === 'RED_CARD') {
      const cardTypeMapped = type === 'YELLOW_CARD' ? 'yellow' : 'red'

      // Create card log
      const card = await prisma.millCard.create({
        data: {
          millId: targetUserId,
          cardType: cardTypeMapped,
          reasonType: 'manual',
          description: reason || 'Manual card issued by admin',
          issuedBy: adminId,
          autoGenerated: false
        }
      })

      // Update trust score and suspensions
      if (type === 'YELLOW_CARD') {
        await prisma.user.update({
          where: { id: targetUserId },
          data: { trustScore: { decrement: 10 } }
        })
      } else {
        await prisma.user.update({
          where: { id: targetUserId },
          data: { trustScore: 0 }
        })
        await prisma.millProfile.update({
          where: { id: targetUserId },
          data: {
            suspended: true,
            suspensionReason: reason || 'Red card suspension',
            suspendedBy: adminId,
            suspendedAt: new Date()
          }
        })
      }

      // Record admin action audit log
      const action = await prisma.adminAction.create({
        data: {
          adminId,
          actionType: type === 'YELLOW_CARD' ? 'yellow_card_issued' : 'red_card_issued',
          targetType: 'mill',
          targetId: targetUserId,
          description: `Issued ${type} to user. Reason: ${reason}`
        }
      })

      return NextResponse.json(action, { status: 201 })
    }

    // 1b. Overriding cards or unsuspending mills
    if (type === 'OVERRIDE_CARD') {
      const { cardId, reason } = body

      // Retrieve the card details
      const card = await prisma.millCard.findUnique({
        where: { id: cardId }
      })

      if (!card) {
        return NextResponse.json({ error: 'Card not found' }, { status: 404 })
      }

      // Update the card to overridden status
      const updatedCard = await prisma.millCard.update({
        where: { id: cardId },
        data: {
          overridden: true,
          overrideReason: reason || 'Card overridden by admin',
          overriddenBy: adminId,
          overriddenAt: new Date()
        }
      })

      // Restore mill stats/status if applicable
      const millId = card.millId
      if (card.cardType === 'yellow') {
        // Restore trust score: increment by 10 (cap at 100)
        const user = await prisma.user.findUnique({
          where: { id: millId },
          select: { trustScore: true }
        })
        if (user) {
          const newTrustScore = Math.min(100, user.trustScore + 10)
          await prisma.user.update({
            where: { id: millId },
            data: { trustScore: newTrustScore }
          })
        }
      } else if (card.cardType === 'red') {
        // Red card override: unsuspend the mill and restore trust score to 80
        await prisma.millProfile.update({
          where: { id: millId },
          data: {
            suspended: false,
            suspensionReason: null,
            suspendedBy: null,
            suspendedAt: null
          }
        })
        
        await prisma.user.update({
          where: { id: millId },
          data: { trustScore: 80 }
        })
      }

      // Create an audit log record
      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: 'card_overridden',
          targetType: 'mill',
          targetId: millId,
          description: `Overrode warning card (${card.cardType}). Reason: ${reason}`
        }
      })

      return NextResponse.json(updatedCard)
    }

    if (type === 'UNSUSPEND_MILL') {
      const { targetUserId, reason } = body
      
      await prisma.millProfile.update({
        where: { id: targetUserId },
        data: {
          suspended: false,
          suspensionReason: null,
          suspendedBy: null,
          suspendedAt: null
        }
      })

      await prisma.user.update({
        where: { id: targetUserId },
        data: { trustScore: 80 }
      })

      const action = await prisma.adminAction.create({
        data: {
          adminId,
          actionType: 'mill_unsuspended',
          targetType: 'mill',
          targetId: targetUserId,
          description: `Unsuspended mill. Reason: ${reason}`
        }
      })

      return NextResponse.json({ success: true, action })
    }

    // 2. Govt Reference Price set/override
    if (type === 'PRICE_OVERRIDE' || type === 'PRICE_UPDATE') {
      const { variety, season, newPrice } = body
      const effectiveFrom = new Date()
      const effectiveTo = new Date()
      effectiveTo.setMonth(effectiveTo.getMonth() + 6) // valid for 6 months

      // Check if price already exists for this variety+season
      const existingPrice = await prisma.govtPrice.findFirst({
        where: {
          variety: variety || 'BRRI dhan28',
          season: season || 'Boro'
        },
        orderBy: { createdAt: 'desc' }
      })

      let govtPrice
      if (existingPrice) {
        // Update existing price
        govtPrice = await prisma.govtPrice.update({
          where: { id: existingPrice.id },
          data: {
            pricePer40kg: newPrice,
            pricePerKg: newPrice / 40,
            effectiveFrom,
            effectiveTo,
            updatedBy: adminId
          }
        })
      } else {
        // Create new price entry
        govtPrice = await prisma.govtPrice.create({
          data: {
            cropType: 'boro', // default crop category
            variety: variety || 'BRRI dhan28',
            pricePer40kg: newPrice,
            pricePerKg: newPrice / 40,
            season: season || 'Boro',
            effectiveFrom,
            effectiveTo,
            createdBy: adminId
          }
        })
      }

      // Audit Log
      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: 'price_update',
          targetType: 'govt_price',
          targetId: govtPrice.id,
          description: `Admin ${existingPrice ? 'updated' : 'set'} govt price for ${variety} (${season}) to ৳${newPrice}/maund`
        }
      })

      return NextResponse.json({
        id: govtPrice.id,
        variety: govtPrice.variety,
        season: govtPrice.season,
        floorPrice: Number(govtPrice.pricePer40kg),
        adminOverride: Number(govtPrice.pricePer40kg),
        updatedAt: govtPrice.updatedAt ? govtPrice.updatedAt.toISOString() : govtPrice.createdAt.toISOString()
      })
    }

    // 3. Ruling on price disputes
    if (type === 'DISPUTE_RULE') {
      const { revisionId, ruling, finalPrice } = body

      const revision = await prisma.priceRevision.update({
        where: { id: revisionId },
        data: {
          adminReviewed: true,
          adminRuling: ruling,
          adminReviewedBy: adminId,
          adminReviewedAt: new Date()
        }
      })

      // Update the transaction final price
      if (finalPrice) {
        await prisma.transaction.update({
          where: { id: revision.transactionId },
          data: {
            finalPrice: finalPrice,
            totalAmount: Number(finalPrice) * 80 // 80 maund fallback or actual quantity
          }
        })
      }

      // Log action
      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: 'dispute_ruled',
          targetType: 'transaction',
          targetId: revision.transactionId,
          description: `Dispute ruled: ${ruling}. Final price set to ৳${finalPrice}/maund.`
        }
      })

      return NextResponse.json(revision)
    }

    // 4. Update platform settings
    if (type === 'UPDATE_SETTING') {
      const { key, value, description } = body

      if (!key || value === undefined) {
        return NextResponse.json({ error: 'Missing key or value' }, { status: 400 })
      }

      const setting = await prisma.platformSettings.upsert({
        where: { key },
        update: {
          value: String(value),
          description: description || undefined,
          updatedBy: adminId
        },
        create: {
          key,
          value: String(value),
          description: description || `Platform setting: ${key}`,
          updatedBy: adminId
        }
      })

      // Audit log
      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: 'setting_updated',
          targetType: 'platform_settings',
          targetId: '00000000-0000-0000-0000-000000000000', // Settings don't have UUID PKs
          description: `Updated platform setting "${key}" to "${value}"`
        }
      })

      return NextResponse.json({
        key: setting.key,
        value: setting.value,
        description: setting.description,
        updatedAt: setting.updatedAt.toISOString()
      })
    }

    return NextResponse.json({ error: 'Invalid action type' }, { status: 400 })
  } catch (err: any) {
    console.error('Error POST /api/admin:', err)
    return NextResponse.json({ error: 'Failed to process admin action', details: err.message }, { status: 500 })
  }
}
