import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify, createRemoteJWKSet } from 'jose'

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

async function verifyFirebaseIdToken(token: string, projectId: string) {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    })
    return payload
  } catch (err) {
    console.error('Firebase token verification failed:', err)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, role, name, district, upazila, millName, idToken } = body

    if (!phone || !role) {
      return NextResponse.json({ error: 'Missing phone or role' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\s+/g, '')

    // Verify Firebase ID Token if Firebase Project ID is configured
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    if (projectId && projectId !== 'mock-project') {
      if (!idToken) {
        return NextResponse.json({ error: 'Missing authentication token' }, { status: 401 })
      }

      const verifiedPayload = await verifyFirebaseIdToken(idToken, projectId)
      if (!verifiedPayload) {
        return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 })
      }

      const tokenPhone = verifiedPayload.phone_number as string
      const normalise = (p: string) => p.replace(/\s+/g, '').replace('+', '')
      if (!tokenPhone || normalise(tokenPhone) !== normalise(cleanPhone)) {
        return NextResponse.json({ error: 'Token phone number mismatch' }, { status: 401 })
      }
    }

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { phone: cleanPhone },
      include: {
        farmerProfile: true,
        millProfile: true
      }
    })

    if (!user) {
      if (!name) {
        return NextResponse.json({ exists: false })
      }
      
      // Step 1: Create the user first
      user = await prisma.user.create({
        data: {
          phone: cleanPhone,
          role: role.toLowerCase() as any,
          name: name,
          district: district || 'Dhaka',
          upazila: upazila || 'Tejgaon',
          verified: true,
          trustScore: 100,
        },
        include: {
          farmerProfile: true,
          millProfile: true
        }
      })

      // Step 2: Create the profile with the same ID as the user (shared 1:1 relation)
      if (role.toLowerCase() === 'farmer') {
        await prisma.farmerProfile.create({
          data: {
            id: user.id,
            nidNumber: null,
            landType: 'own',
            primaryCrops: ['boro'],
            bkashNumber: cleanPhone
          }
        })
      } else if (role.toLowerCase() === 'mill') {
        await prisma.millProfile.create({
          data: {
            id: user.id,
            millName: millName || 'Registered Mill',
            publicVisible: true,
            buyingPreferences: { crop_types: ['boro'], grades: ['A'], districts: ['Dhaka'] }
          }
        })
      }

      // Step 3: Fetch the user again with the profile included
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          farmerProfile: true,
          millProfile: true
        }
      })
    }

    return NextResponse.json({
      id: user!.id,
      name: user!.name,
      phone: user!.phone,
      role: user!.role.toUpperCase(),
      profileId: user!.id,
      verified: user!.verified,
      trustScore: user!.trustScore,
      district: user!.district,
      upazila: user!.upazila,
      farmerProfile: user!.farmerProfile,
      millProfile: user!.millProfile
    })
  } catch (err: any) {
    console.error('Error syncing user:', err)
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 })
  }
}
