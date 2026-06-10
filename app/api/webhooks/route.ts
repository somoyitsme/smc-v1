import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendSms } from '@/lib/sms'
import { renderTemplate, type TemplateKey } from '@/lib/sms-templates'

// ═══════════════════════════════════════════════════════════════
// KrishiDam — n8n Webhook Endpoints
// Called by n8n automation workflows for cron jobs and notifications
// ═══════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action } = body

    // ─── Workflow 4: Listing Expiry Cron (every 6 hours) ─────
    if (action === 'expire-listings') {
      // Fetch the configured expiry window from platform settings
      const expirySetting = await prisma.platformSettings.findUnique({
        where: { key: 'listing_expiry_days' }
      })
      const expiryDays = expirySetting ? parseInt(expirySetting.value) : 7

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - expiryDays)

      // Find and expire active listings past the cutoff
      const expiredListings = await prisma.cropListing.findMany({
        where: {
          status: 'active',
          expiresAt: { lte: new Date() }
        },
        include: {
          farmer: {
            select: { phone: true, name: true }
          }
        }
      })

      const results: { listingId: string; farmerPhone: string; smsSent: boolean }[] = []

      for (const listing of expiredListings) {
        // Update listing status
        await prisma.cropListing.update({
          where: { id: listing.id },
          data: { status: 'expired' }
        })

        // Send SMS to farmer
        const smsMessage = renderTemplate('FARMER_LISTING_EXPIRED', {
          cropType: `${listing.variety} (${listing.cropType})`
        })

        const smsResult = await sendSms({
          to: listing.farmer.phone,
          message: smsMessage
        })

        // Log notification
        await prisma.notificationLog.create({
          data: {
            userId: listing.farmerId,
            channel: 'sms',
            type: 'LISTING_EXPIRED',
            message: smsMessage,
            delivered: smsResult.success
          }
        })

        results.push({
          listingId: listing.id,
          farmerPhone: listing.farmer.phone,
          smsSent: smsResult.success
        })
      }

      return NextResponse.json({
        action: 'expire-listings',
        expiredCount: results.length,
        results
      })
    }

    // ─── Workflow 5: Daily Admin Digest (8am) ─────────────────
    if (action === 'admin-digest') {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const [
        newFarmers,
        newMills,
        newListings,
        newTransactions,
        unreviewedDisputes,
        activeYellowCards,
        activeRedCards
      ] = await Promise.all([
        prisma.user.count({ where: { role: 'farmer', createdAt: { gte: yesterday } } }),
        prisma.user.count({ where: { role: 'mill', createdAt: { gte: yesterday } } }),
        prisma.cropListing.count({ where: { createdAt: { gte: yesterday } } }),
        prisma.transaction.count({ where: { createdAt: { gte: yesterday } } }),
        prisma.priceRevision.count({ where: { farmerDisputed: true, adminReviewed: false } }),
        prisma.millCard.count({ where: { cardType: 'yellow', overridden: false, createdAt: { gte: yesterday } } }),
        prisma.millCard.count({ where: { cardType: 'red', overridden: false, createdAt: { gte: yesterday } } })
      ])

      // Calculate total revenue from yesterday's transactions
      const recentTx = await prisma.transaction.findMany({
        where: { createdAt: { gte: yesterday }, deliveryStatus: 'confirmed' },
        select: { totalAmount: true }
      })
      const dailyRevenue = recentTx.reduce((sum, t) => sum + Number(t.totalAmount), 0)

      // Fetch admin phone for SMS dispatch
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } })

      const digest = {
        date: new Date().toISOString().split('T')[0],
        newFarmers,
        newMills,
        newListings,
        newTransactions,
        unreviewedDisputes,
        activeYellowCards,
        activeRedCards,
        dailyRevenue,
        adminPhone: admin?.phone || null
      }

      // Send digest SMS to admin
      if (admin) {
        const digestSms = `[KrishiDam Daily] নতুন কৃষক: ${newFarmers}, মিল: ${newMills}, লিস্টিং: ${newListings}, লেনদেন: ${newTransactions}, বিরোধ: ${unreviewedDisputes}, হলুদ কার্ড: ${activeYellowCards}, লাল কার্ড: ${activeRedCards}`

        await sendSms({ to: admin.phone, message: digestSms })

        await prisma.notificationLog.create({
          data: {
            userId: admin.id,
            channel: 'sms',
            type: 'ADMIN_DAILY_DIGEST',
            message: digestSms,
            delivered: true
          }
        })
      }

      return NextResponse.json({ action: 'admin-digest', digest })
    }

    // ─── Generic SMS Notification Dispatch ────────────────────
    if (action === 'send-notification') {
      const { userId, templateKey, templateParams } = body

      if (!userId || !templateKey) {
        return NextResponse.json({ error: 'Missing userId or templateKey' }, { status: 400 })
      }

      // Fetch user phone
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true }
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      // Render the SMS template
      const message = renderTemplate(templateKey as TemplateKey, templateParams || {})

      // Send SMS
      const smsResult = await sendSms({ to: user.phone, message })

      // Log to notification_log
      await prisma.notificationLog.create({
        data: {
          userId,
          channel: 'sms',
          type: templateKey,
          message,
          delivered: smsResult.success
        }
      })

      return NextResponse.json({
        action: 'send-notification',
        userId,
        templateKey,
        message,
        delivered: smsResult.success,
        messageId: smsResult.messageId
      })
    }

    // ─── Workflow 1: Match Mills for New Listing ──────────────
    if (action === 'match-mills-notify') {
      const { listingId } = body

      if (!listingId) {
        return NextResponse.json({ error: 'Missing listingId' }, { status: 400 })
      }

      const listing = await prisma.cropListing.findUnique({
        where: { id: listingId },
        include: { farmer: { select: { name: true, district: true } } }
      })

      if (!listing) {
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
      }

      // Fetch all mill profiles with matching preferences
      const allMills = await prisma.millProfile.findMany({
        where: { suspended: false, publicVisible: true },
        include: {
          user: { select: { id: true, phone: true, name: true } }
        }
      })

      // Match mills based on buying preferences
      const matchedMills = allMills.filter(mill => {
        const prefs = mill.buyingPreferences as any
        if (!prefs) return true // No preferences set = interested in all

        const cropMatch = !prefs.crop_types || prefs.crop_types.includes(listing.cropType)
        const gradeMatch = !prefs.grades || prefs.grades.includes(listing.qualityGrade)
        const districtMatch = !prefs.districts || prefs.districts.includes(listing.locationDistrict)

        return cropMatch && (gradeMatch || districtMatch)
      })

      const notifications: { millId: string; millName: string; phone: string; smsSent: boolean }[] = []

      for (const mill of matchedMills) {
        const smsMessage = renderTemplate('MILL_NEW_MATCHING_LISTING', {
          cropType: `${listing.variety} (${listing.cropType})`,
          quantityKg: listing.quantityKg,
          district: listing.locationDistrict,
          floorPricePerKg: Number(listing.aiFloorPrice) / 40
        })

        const smsResult = await sendSms({ to: mill.user.phone, message: smsMessage })

        await prisma.notificationLog.create({
          data: {
            userId: mill.user.id,
            channel: 'sms',
            type: 'MILL_NEW_MATCHING_LISTING',
            message: smsMessage,
            delivered: smsResult.success
          }
        })

        notifications.push({
          millId: mill.id,
          millName: mill.millName,
          phone: mill.user.phone,
          smsSent: smsResult.success
        })
      }

      return NextResponse.json({
        action: 'match-mills-notify',
        listingId,
        matchedCount: matchedMills.length,
        notifications
      })
    }

    return NextResponse.json({ error: 'Invalid webhook action' }, { status: 400 })
  } catch (err: any) {
    console.error('Error POST /api/webhooks:', err)
    return NextResponse.json({ error: 'Webhook processing failed', details: err.message }, { status: 500 })
  }
}
