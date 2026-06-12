import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { triageComplaint, triageMultipleComplaints } from '@/lib/ai'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'triage-text') {
      const text = searchParams.get('text') || ''
      const result = triageComplaint(text)
      return NextResponse.json(result)
    }

    const status = searchParams.get('status')
    const where: any = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const complaints = await prisma.complaint.findMany({
      where,
      orderBy: { aiFraudScore: 'desc' },
      include: {
        filedByUser: { select: { id: true, name: true, phone: true, district: true } },
        targetUser: { select: { id: true, name: true, phone: true } },
      },
    })

    const unanalyzed = complaints.filter(c => !c.aiCategory)

    if (unanalyzed.length > 0) {
      const triaged = triageMultipleComplaints(
        unanalyzed.map(c => ({ id: c.id, title: c.title, description: c.description }))
      )

      await Promise.all(
        triaged.map(async ({ id, triage }) => {
          await prisma.complaint.update({
            where: { id },
            data: {
              aiCategory: triage.category,
              aiPriority: triage.priority,
              aiFraudScore: triage.fraudScore,
              aiSummary: triage.summary,
              aiSuggestion: triage.suggestion,
              aiAnalyzedAt: new Date(),
              category: triage.category as any,
              priority: triage.priority as any,
            },
          })
        })
      )
    }

    const updatedComplaints = await prisma.complaint.findMany({
      where,
      orderBy: { aiFraudScore: 'desc' },
      include: {
        filedByUser: { select: { id: true, name: true, phone: true, district: true } },
        targetUser: { select: { id: true, name: true, phone: true } },
      },
    })

    // Sort by priority (high -> medium -> low) then by fraud score descending
    const priorityWeights: Record<string, number> = { high: 3, medium: 2, low: 1 }
    const sortedComplaints = [...updatedComplaints].sort((a, b) => {
      const wA = priorityWeights[(a.aiPriority || a.priority || '').toLowerCase()] || 0
      const wB = priorityWeights[(b.aiPriority || b.priority || '').toLowerCase()] || 0
      if (wA !== wB) return wB - wA
      return (b.aiFraudScore || 0) - (a.aiFraudScore || 0)
    })

    return NextResponse.json(sortedComplaints)
  } catch (err: any) {
    console.error('Error in complaints AI:', err)
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type } = body

    if (type === 'triage') {
      const { title, description } = body
      const result = triageComplaint(`${title || ''} ${description || ''}`)
      return NextResponse.json(result)
    }

    if (type === 'create') {
      const { title, description, filedBy, targetUserId, transactionId, listingId, district, upazila } = body

      if (!title || !description || !filedBy) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      const triage = triageComplaint(`${title} ${description}`)

      const complaint = await prisma.complaint.create({
        data: {
          title,
          description,
          filedBy,
          targetUserId: targetUserId || null,
          transactionId: transactionId || null,
          listingId: listingId || null,
          district: district || null,
          upazila: upazila || null,
          category: triage.category as any,
          priority: triage.priority as any,
          aiCategory: triage.category,
          aiPriority: triage.priority,
          aiFraudScore: triage.fraudScore,
          aiSummary: triage.summary,
          aiSuggestion: triage.suggestion,
          aiAnalyzedAt: new Date(),
        },
        include: {
          filedByUser: { select: { id: true, name: true, phone: true, district: true } },
          targetUser: { select: { id: true, name: true, phone: true } },
        },
      })

      return NextResponse.json(complaint, { status: 201 })
    }

    if (type === 'update-status') {
      const { complaintId, status, adminNotes, resolvedBy } = body

      const updateData: any = { status }
      if (adminNotes) updateData.adminNotes = adminNotes
      if (resolvedBy) updateData.resolvedBy = resolvedBy
      if (status === 'resolved' || status === 'dismissed') updateData.resolvedAt = new Date()

      const complaint = await prisma.complaint.update({
        where: { id: complaintId },
        data: updateData,
        include: {
          filedByUser: { select: { id: true, name: true, phone: true, district: true } },
          targetUser: { select: { id: true, name: true, phone: true } },
        },
      })

      return NextResponse.json(complaint)
    }

    return NextResponse.json({ error: 'Unknown action type' }, { status: 400 })
  } catch (err: any) {
    console.error('Error in complaints AI POST:', err)
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 })
  }
}
