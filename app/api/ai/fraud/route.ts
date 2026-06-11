import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeFraudRisk } from '@/lib/ai'

export async function GET() {
  try {
    const [transactions, mills, revisions, complaints] = await Promise.all([
      prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.millProfile.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              trustScore: true,
              cardsAsMill: true,
            }
          },
        },
      }),
      prisma.priceRevision.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.complaint.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ])

    const millData = mills.map(m => ({
      id: m.id,
      millName: m.millName,
      trustScore: m.user.trustScore,
      yellowCards: m.user.cardsAsMill.filter(c => c.cardType === 'yellow' && !c.overridden).length,
      redCards: m.user.cardsAsMill.filter(c => c.cardType === 'red' && !c.overridden).length,
      suspended: m.suspended,
      totalDeals: m.user.trustScore,
      completedDeals: 0,
    }))

    const transactionData = transactions.map(t => ({
      id: t.id,
      agreedPrice: Number(t.agreedPrice),
      finalPrice: Number(t.finalPrice),
      totalAmount: Number(t.totalAmount),
      paymentStatus: t.paymentStatus,
      deliveryStatus: t.deliveryStatus,
      priceRevised: t.priceRevised,
      createdAt: t.createdAt,
      farmerId: t.farmerId,
      millId: t.millId,
    }))

    const revisionData = revisions.map(r => ({
      id: r.id,
      originalPrice: Number(r.originalPrice),
      revisedPrice: Number(r.revisedPrice),
      reason: r.reason,
      farmerDisputed: r.farmerDisputed,
      adminReviewed: r.adminReviewed,
      millId: r.millId,
      createdAt: r.createdAt,
    }))

    const complaintData = complaints.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      status: c.status,
      aiFraudScore: c.aiFraudScore,
      targetUserId: c.targetUserId,
      createdAt: c.createdAt,
    }))

    const result = analyzeFraudRisk({
      transactions: transactionData,
      mills: millData,
      revisions: revisionData,
      complaints: complaintData,
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Error in fraud AI:', err)
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 })
  }
}
