import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: pg.Pool | undefined
}

function createPrismaClient() {
  // Prefer Transaction Pooler connection (DATABASE_URL) over Session connection (DIRECT_URL) for serverless scalability
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
  
  // Cache the pg.Pool globally to reuse connections across serverless warm container invocations
  let pool = globalForPrisma.pool
  if (!pool) {
    pool = new pg.Pool({ 
      connectionString,
      max: 2, // Keep connections per instance small to prevent exhausting the Supabase pool
      idleTimeoutMillis: 10000, // Close idle connections quickly
    })
    globalForPrisma.pool = pool
  }
  
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

globalForPrisma.prisma = prisma

