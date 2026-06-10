// ═══════════════════════════════════════════════════════════════
// KrishiDam — Audit Logger (Migrated to AdminAction)
// ═══════════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

export async function logAudit(entry: {
  userId?: string
  action: string
  entity: string
  entityId: string
  details: any
  ipAddress?: string
}): Promise<void> {
  try {
    const adminId = entry.userId || '00000000-0000-0000-0000-000000000001' // System Admin fallback
    const targetIdValid = (entry.entityId && entry.entityId.length === 36)
      ? entry.entityId
      : '00000000-0000-0000-0000-000000000000'

    await prisma.adminAction.create({
      data: {
        adminId,
        actionType: entry.action,
        targetType: entry.entity,
        targetId: targetIdValid,
        description: typeof entry.details === 'string' 
          ? entry.details 
          : JSON.stringify(entry.details)
      }
    })
  } catch (error) {
    console.error('Failed to write audit log:', error)
  }
}

export async function getAuditLogs(options?: {
  userId?: string
  action?: string
  entity?: string
  limit?: number
  offset?: number
}) {
  try {
    const actions = await prisma.adminAction.findMany({
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
      include: {
        admin: {
          select: { name: true, role: true }
        }
      }
    })

    return actions.map(act => ({
      id: act.id,
      userId: act.adminId,
      action: act.actionType,
      entity: act.targetType,
      entityId: act.targetId,
      details: act.description,
      createdAt: act.createdAt,
      user: act.admin
    }))
  } catch {
    return []
  }
}
