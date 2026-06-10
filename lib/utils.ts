// ═══════════════════════════════════════════════════════════════
// KrishiDam — Utility Functions
// ═══════════════════════════════════════════════════════════════

import { format, formatDistanceToNow, isAfter } from 'date-fns'

// Format currency in Bangladeshi Taka
export function formatTaka(amount: number): string {
  return `৳${amount.toLocaleString('en-BD')}`
}

// Format date
export function formatDate(date: Date | string): string {
  return format(new Date(date), 'dd MMM yyyy')
}

// Format date with time
export function formatDateTime(date: Date | string): string {
  return format(new Date(date), 'dd MMM yyyy, hh:mm a')
}

// Relative time
export function timeAgo(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

// Check if expired
export function isExpired(date: Date | string): boolean {
  return !isAfter(new Date(date), new Date())
}

// Status badge color mapping
export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    'ACTIVE': 'badge-emerald',
    'BIDDING': 'badge-amber',
    'AWARDED': 'badge-sky',
    'COMPLETED': 'badge-emerald',
    'CANCELLED': 'badge-muted',
    'EXPIRED': 'badge-muted',
    'PENDING': 'badge-amber',
    'ACCEPTED': 'badge-emerald',
    'REJECTED': 'badge-danger',
    'OUTBID': 'badge-muted',
    'WITHDRAWN': 'badge-muted',
    'IN_TRANSIT': 'badge-sky',
    'DELIVERED': 'badge-emerald',
    'DISPUTED': 'badge-danger',
  }
  return map[status] || 'badge-muted'
}

// Role colors
export function getRoleColor(role: string): string {
  const map: Record<string, string> = {
    'FARMER': 'active',
    'MILL': 'active-amber',
    'ADMIN': 'active-sky',
  }
  return map[role] || 'active'
}

// Generate initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Grade label
export function gradeLabel(grade: string): string {
  const map: Record<string, string> = {
    'A': 'Premium',
    'B': 'Standard',
    'C': 'Economy',
  }
  return map[grade] || grade
}

// Season label with Bengali
export function seasonLabel(season: string): string {
  const map: Record<string, string> = {
    'BORO': 'Boro (বোরো)',
    'AMAN': 'Aman (আমন)',
    'AUS': 'Aus (আউশ)',
  }
  return map[season] || season
}

// Quantity in maund
export function formatQuantity(maund: number): string {
  if (maund >= 100) {
    return `${(maund / 100).toFixed(1)} ton`
  }
  return `${maund} মন`
}

// Truncate text
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}

// CN - conditional class names
export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
