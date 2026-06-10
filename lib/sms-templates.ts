// ═══════════════════════════════════════════════════════════════
// KrishiDam — SMS Notification Template Library
// Bengali (BN) primary templates for GreenSMS via n8n
// ═══════════════════════════════════════════════════════════════

// ─── FARMER TEMPLATES ─────────────────────────────────────────

interface FarmerContactParams {
  millName: string
  cropType: string
  pricePerKg: number
}

export function farmerNewContactRequest({ millName, cropType, pricePerKg }: FarmerContactParams): string {
  return `${millName} আপনার ${cropType} কিনতে আগ্রহী। অফার: ৳${pricePerKg}/কেজি। KrishiDam-এ দেখুন।`
}

interface FarmerOfferUpdatedParams {
  millName: string
  pricePerKg: number
}

export function farmerOfferUpdated({ millName, pricePerKg }: FarmerOfferUpdatedParams): string {
  return `${millName} নতুন অফার দিয়েছে: ৳${pricePerKg}/কেজি। KrishiDam-এ উত্তর দিন।`
}

interface FarmerDealConfirmedParams {
  millName: string
  quantityKg: number
  pricePerKg: number
  millPhone: string
}

export function farmerDealConfirmed({ millName, quantityKg, pricePerKg, millPhone }: FarmerDealConfirmedParams): string {
  return `চুক্তি সম্পন্ন। ${millName}-এর সাথে ${quantityKg}কেজি ৳${pricePerKg}/কেজিতে। যোগাযোগ: ${millPhone}`
}

interface FarmerListingExpiredParams {
  cropType: string
}

export function farmerListingExpired({ cropType }: FarmerListingExpiredParams): string {
  return `আপনার ${cropType} লিস্টিং মেয়াদ শেষ। নতুন পোস্ট করুন।`
}

interface FarmerPriceRevisedParams {
  millName: string
}

export function farmerPriceRevised({ millName }: FarmerPriceRevisedParams): string {
  return `সতর্কতা: ${millName} ডেলিভারিতে দাম কমিয়েছে। এটি পাবলিক রেকর্ডে যাবে।`
}

export function farmerDisputeRuled(): string {
  return `আপনার অভিযোগের সিদ্ধান্ত হয়েছে। KrishiDam-এ বিস্তারিত দেখুন।`
}

// ─── MILL TEMPLATES ───────────────────────────────────────────

interface MillNewListingParams {
  cropType: string
  quantityKg: number
  district: string
  floorPricePerKg: number
}

export function millNewMatchingListing({ cropType, quantityKg, district, floorPricePerKg }: MillNewListingParams): string {
  return `নতুন ${cropType} ${quantityKg}কেজি ${district}-এ। ন্যূনতম: ৳${floorPricePerKg}/কেজি। KrishiDam দেখুন।`
}

export function millYellowCard(): string {
  return `সতর্কতা: আপনার মিলে একটি হলুদ কার্ড যোগ হয়েছে। KrishiDam অ্যাডমিন রিভিউ করবে।`
}

export function millRedCard(): string {
  return `জরুরি: আপনার মিলে একটি লাল কার্ড যোগ হয়েছে। KrishiDam অ্যাডমিনের সাথে যোগাযোগ করুন।`
}

interface MillSuspensionParams {
  reason: string
}

export function millSuspensionNotice({ reason }: MillSuspensionParams): string {
  return `আপনার মিল সাময়িকভাবে স্থগিত করা হয়েছে। কারণ: ${reason}। যোগাযোগ: admin@krishidam.com`
}

// ─── OTP TEMPLATE ─────────────────────────────────────────────

interface OtpParams {
  code: string
}

export function otpCode({ code }: OtpParams): string {
  return `আপনার KrishiDam কোড: ${code}। ১০ মিনিটের জন্য বৈধ।`
}

// ─── TEMPLATE REGISTRY ────────────────────────────────────────
// Maps template keys to their generator functions for n8n webhook dispatch

export type TemplateKey =
  | 'FARMER_NEW_CONTACT_REQUEST'
  | 'FARMER_OFFER_UPDATED'
  | 'FARMER_DEAL_CONFIRMED'
  | 'FARMER_LISTING_EXPIRED'
  | 'FARMER_PRICE_REVISED'
  | 'FARMER_DISPUTE_RULED'
  | 'MILL_NEW_MATCHING_LISTING'
  | 'MILL_YELLOW_CARD'
  | 'MILL_RED_CARD'
  | 'MILL_SUSPENSION_NOTICE'
  | 'OTP_CODE'

export function renderTemplate(key: TemplateKey, params: Record<string, any>): string {
  switch (key) {
    case 'FARMER_NEW_CONTACT_REQUEST':
      return farmerNewContactRequest(params as FarmerContactParams)
    case 'FARMER_OFFER_UPDATED':
      return farmerOfferUpdated(params as FarmerOfferUpdatedParams)
    case 'FARMER_DEAL_CONFIRMED':
      return farmerDealConfirmed(params as FarmerDealConfirmedParams)
    case 'FARMER_LISTING_EXPIRED':
      return farmerListingExpired(params as FarmerListingExpiredParams)
    case 'FARMER_PRICE_REVISED':
      return farmerPriceRevised(params as FarmerPriceRevisedParams)
    case 'FARMER_DISPUTE_RULED':
      return farmerDisputeRuled()
    case 'MILL_NEW_MATCHING_LISTING':
      return millNewMatchingListing(params as MillNewListingParams)
    case 'MILL_YELLOW_CARD':
      return millYellowCard()
    case 'MILL_RED_CARD':
      return millRedCard()
    case 'MILL_SUSPENSION_NOTICE':
      return millSuspensionNotice(params as MillSuspensionParams)
    case 'OTP_CODE':
      return otpCode(params as OtpParams)
    default:
      return `[KrishiDam] Notification`
  }
}
