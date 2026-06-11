import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateInsights } from '@/lib/ai'

export async function GET() {
  try {
    const [complaints, transactions, mills, users, inventories, listings] = await Promise.all([
      prisma.complaint.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          district: true,
          category: true,
          status: true,
          createdAt: true,
          aiFraudScore: true,
        },
      }),
      prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          agreedPrice: true,
          finalPrice: true,
          paymentStatus: true,
          deliveryStatus: true,
          priceRevised: true,
          createdAt: true,
          farmerId: true,
          millId: true,
        },
      }),
      prisma.millProfile.findMany({
        include: {
          user: { select: { trustScore: true } },
          cardsAsMill: true,
        },
      }),
      prisma.user.findMany({
        where: { role: 'farmer' },
        include: {
          farmerProfile: true,
        },
      }),
      prisma.millInventory.findMany(),
      prisma.cropListing.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const millData = mills.map(m => ({
      id: m.id,
      millName: m.millName,
      trustScore: m.user.trustScore,
      suspended: m.suspended,
      yellowCards: m.cardsAsMill.filter(c => c.cardType === 'yellow' && !c.overridden).length,
      totalDeals: 0,
    }))

    const farmerData = users.map(u => ({
      id: u.id,
      name: u.name,
      district: u.district,
      totalListings: u.farmerProfile?.totalListings || 0,
      completedDeals: u.farmerProfile?.completedDeals || 0,
      trustScore: u.trustScore,
    }))

    const insights = generateInsights({
      complaints,
      transactions,
      mills: millData,
      farmers: farmerData,
      inventories,
      listings,
    })

    const complaintStats = {
      total: complaints.length,
      pending: complaints.filter(c => c.status === 'pending').length,
      underReview: complaints.filter(c => c.status === 'under_review').length,
      resolved: complaints.filter(c => c.status === 'resolved').length,
      dismissed: complaints.filter(c => c.status === 'dismissed').length,
      byCategory: {
        overpricing: complaints.filter(c => c.category === 'overpricing').length,
        delivery_issue: complaints.filter(c => c.category === 'delivery_issue').length,
        fraud: complaints.filter(c => c.category === 'fraud').length,
        product_quality: complaints.filter(c => c.category === 'product_quality').length,
        other: complaints.filter(c => c.category === 'other').length,
      },
      byPriority: {
        high: complaints.filter(c => c.priority === 'high').length,
        medium: complaints.filter(c => c.priority === 'medium').length,
        low: complaints.filter(c => c.priority === 'low').length,
      },
    }

    const fraudStats = {
      highFraudComplaints: complaints.filter(c => (c.aiFraudScore ?? 0) >= 70).length,
      suspendedMills: millData.filter(m => m.suspended).length,
      priceRevisedTransactions: transactions.filter(t => t.priceRevised).length,
    }

    return NextResponse.json({
      insights,
      complaintStats,
      fraudStats,
      generatedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('Error in analytics AI:', err)
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 })
  }
}
