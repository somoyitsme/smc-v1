import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

// POST /api/payments - Webhook receiver for bKash and Nagad payments
export async function POST(request: Request) {
  try {
    const payload = await request.json()
    console.log('[Payment Webhook] Received payload:', payload)

    // Identify provider (bKash or Nagad) and extract key fields
    let provider = 'unknown'
    let trxId = ''
    let amount = 0
    let referenceId = '' // Maps to our Transaction model ID
    let isSuccess = false

    // bKash Webhook Format
    if (payload.trxID && payload.transactionStatus !== undefined) {
      provider = 'bKash'
      trxId = payload.trxID
      amount = parseFloat(payload.amount || '0')
      referenceId = payload.merchantInvoiceNumber || payload.reference || ''
      isSuccess = payload.transactionStatus === 'Completed' || payload.transactionStatus === 'Success'
    }
    // Nagad Webhook Format
    else if (payload.payment_ref_id && payload.status !== undefined) {
      provider = 'Nagad'
      trxId = payload.payment_ref_id
      amount = parseFloat(payload.amount || '0')
      referenceId = payload.order_id || payload.merchantInvoiceNumber || ''
      isSuccess = payload.status === 'Success'
    }
    // Generic/Manual Fallback Format
    else {
      provider = payload.provider || 'Generic'
      trxId = payload.trxId || payload.transactionId || ''
      amount = parseFloat(payload.amount || '0')
      referenceId = payload.referenceId || payload.orderId || ''
      isSuccess = payload.status === 'SUCCESS' || payload.success === true
    }

    if (!trxId || !referenceId) {
      return NextResponse.json(
        { error: 'Missing transaction or reference IDs' },
        { status: 400 }
      )
    }

    // Find the associated transaction in database
    const transaction = await prisma.transaction.findUnique({
      where: { id: referenceId },
      include: {
        mill: true,
        listing: { include: { farmer: true } }
      }
    })

    if (!transaction) {
      console.warn(`[Payment Webhook] Transaction not found for reference ID: ${referenceId}`)
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    if (isSuccess) {
      // Update transaction status
      await prisma.transaction.update({
        where: { id: referenceId },
        data: {
          paymentStatus: 'completed',
          deliveryStatus: 'confirmed',
          completedAt: new Date()
        }
      })

      // Also update crop listing status to sold
      await prisma.cropListing.update({
        where: { id: transaction.listingId },
        data: { status: 'sold' }
      })

      // Write to audit log
      await logAudit({
        userId: transaction.millId,
        action: 'TRANSACTION_COMPLETED',
        entity: 'Transaction',
        entityId: referenceId,
        details: {
          provider,
          trxId,
          amount,
          listingId: transaction.listingId,
          farmerName: transaction.listing.farmer.name,
          millName: (transaction.mill as any)?.millProfile?.millName || transaction.mill.name
        }
      })

      console.log(`[Payment Webhook] Successful payment processed for transaction ${referenceId} via ${provider}. TrxID: ${trxId}`)
    } else {
      console.warn(`[Payment Webhook] Payment failed or cancelled for transaction ${referenceId} via ${provider}.`)
    }

    return NextResponse.json({ success: true, provider, trxId, referenceId })
  } catch (err: any) {
    console.error('[Payment Webhook] Error processing payment webhook:', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    )
  }
}
