'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Sprout, Factory, Shield, TrendingUp, Star,
  MapPin, Scale, Wheat, Clock, ArrowUpRight, ArrowDownRight,
  Package, Gavel, CheckCircle2, AlertTriangle, XCircle,
  BarChart3, Users, Activity, FileText, Eye, Plus,
  Send, Truck, Award, Ban, Search, Filter,
  Info, Leaf, Building2, Crown, Globe, Zap,
  Sun, Moon, Languages, Phone, LogOut, Lock, MessageSquare, Trash2,
  Settings, CreditCard, Tag, DollarSign, PieChart
} from 'lucide-react'
import { auth, isFirebaseConfigured } from '@/lib/firebase'
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, onAuthStateChanged, signOut } from 'firebase/auth'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'

// ═══════════════════════════════════════════════════════════════
// KrishiDam — Main Application (Tailwind + Supabase Auth + Dual Language)
// ═══════════════════════════════════════════════════════════════

type Role = 'LANDING' | 'FARMER' | 'MILL' | 'ADMIN' | 'MARKET' | 'PRICING'
type Lang = 'BN' | 'EN'
type Theme = 'light' | 'dark'

interface Listing {
  id: string
  variety: string
  season: string
  quantity: number
  quantityKg: number
  qualityGrade: string
  moisturePct: number
  chitaPct: number
  description: string | null
  aiFloorPrice: number
  askingPrice: number | null
  district: string
  upazila: string
  status: string
  harvestDate: string | null
  expiresAt: string
  createdAt: string
  farmer: {
    id: string
    district: string
    user: { name: string; nameBn: string | null; phone: string | null }
  }
  bids: Bid[]
  _count: { bids: number }
}

interface Bid {
  id: string
  listingId: string
  pricePerMaund: number
  totalPrice: number
  notes: string | null
  status: string
  createdAt: string
  mill: {
    id: string
    millName: string
    rating: number
    totalDeals: number
    greenCards?: number
    yellowCards?: number
    redCards?: number
    trustScore?: number
    user: { name: string; nameBn: string | null }
  }
  messages: {
    id: string
    senderId: string
    senderRole: string
    message: string
    priceOffered: number | null
    createdAt: string
  }[]
  listing?: {
    variety: string
    quantity: number
    district: string
    status: string
    aiFloorPrice: number
  }
}

interface MarketPrice {
  variety: string
  currentPrice: number
  previousPrice: number
  change: number
  changePercent: number
  source: string
  recordedAt: string
}

interface MillInventory {
  id: string
  millId: string
  millName: string
  riceType: string
  category: string
  quantityMaund: number
  pricePerKg: number
  pricePerMaund: number
  notes: string | null
  updatedAt: string
  millTrustScore: number
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

// Translation Dictionaries (Bengali Primary, English Optional Toggle)
const TRANSLATIONS = {
  BN: {
    title: 'কৃষিদাম',
    market: 'বাজার',
    farmer: 'কৃষক',
    mill: 'মিল',
    admin: 'অ্যাডমিন',
    login: 'লগইন',
    logout: 'লগআউট',
    tagline: 'কৃষকের উৎপাদিত ধানের ন্যায্য মূল্য নিশ্চিতকরণে রিভার্স অকশন প্ল্যাটফর্ম',
    subTagline: 'রিভার্স অকশন প্ল্যাটফর্ম যেখানে রাইস মিলগুলো কৃষকের ধানের জন্য প্রতিযোগিতা করে। এআই-নির্ধারিত সর্বনিম্ন মূল্য এবং সম্পূর্ণ পাবলিক ও স্বচ্ছ রেকর্ড।',
    enterFarmer: 'কৃষক ড্যাশবোর্ড',
    enterMill: 'মিল ড্যাশবোর্ড',
    enterAdmin: 'অ্যাডমিন প্যানেল',
    viewMarket: 'বাজার দর দেখুন',
    liveMarket: 'সরাসরি ধানের বাজার দর',
    differenceTitle: 'আমাদের বৈশিষ্ট্য',
    features: [
      { title: 'রিভার্স অকশন', desc: 'কৃষক ধান তালিকাভুক্ত করেন, মিলাররা বিড করেন। মিলারদের মধ্যে প্রতিযোগিতা ধানের দাম বাড়িয়ে দেয়।' },
      { title: 'এআই প্রাইস ফ্লোর', desc: 'কোনো বিডই এআই নির্ধারিত সর্বনিম্ন দামের নিচে গ্রহণযোগ্য নয়। শোষণমুক্ত ব্যবসা নিশ্চিত।' },
      { title: 'পাবলিক রেকর্ড', desc: 'প্রতিটি বিড, লেনদেন ও অডিট ট্রেইল জনসাধারণের কাছে উন্মুক্ত ও স্থায়ীভাবে সংরক্ষিত।' },
      { title: 'অ্যাডমিন গভর্নেন্স', desc: 'হলুদ ও লাল কার্ড সতর্কীকরণ ব্যবস্থার মাধ্যমে মিলারদের আচরণের কড়া নজরদারি।' }
    ],
    livePrices: 'সরাসরি বাজার দর',
    activeFarmers: 'সক্রিয় কৃষক',
    activeMills: 'সক্রিয় মিলসমূহ',
    valueTraded: 'মোট লেনদেনের পরিমাণ',
    aiFairPrice: 'এআই ন্যায্য মূল্য',
    viewFullMarket: 'সম্পূর্ণ বাজার দেখুন',
    ctaHeading: 'ধান ব্যবসার রূপান্তর করতে প্রস্তুত?',
    ctaSub: 'কৃষিদামে যোগ দিন — আপনি ধান চাষি বা প্রক্রিয়াজাতকারী হোন না কেন, এই প্ল্যাটফর্ম সবার জন্য ন্যায্যতা নিশ্চিত করে।',
    footerText: 'কৃষিদাম — ক্লাউড ক্যাম্প বিডি × ইনফিনিটি এআই বিল্ডফেস্ট ২০২৬',

    // Dashboards Common
    welcome: 'স্বাগতম',
    completed: 'সম্পন্ন',
    active: 'চলমান',
    pending: 'অপেক্ষমাণ',
    rejected: 'প্রত্যাখ্যাত',
    cancelled: 'বাতিল',
    expired: 'মেয়াদোত্তীর্ণ',
    maund: 'মন',
    grade: 'গ্রেড',
    district: 'জেলা',
    upazila: 'উপজেলা',
    expiresIn: 'বাকি আছে',
    days: 'দিন',
    bidsCount: 'দর প্রস্তাব সমূহ',
    totalBids: 'মোট দরপত্র',
    aiFloorPrice: 'এআই সর্বনিম্ন দাম',
    askingPrice: 'প্রত্যাশিত দাম',
    bestBid: 'সর্বোচ্চ দর প্রস্তাব',
    totalValue: 'মোট মূল্য',
    noBids: 'কোনো দরপ্রস্তাব জমা পড়েনি',
    actionAccept: 'গ্রহণ করুন',
    actionReject: 'প্রত্যাখ্যান',
    notes: 'মন্তব্য',

    // Farmer Dashboard
    farmerTitle: 'কৃষক ড্যাশবোর্ড',
    newListingBtn: 'নতুন লিস্টিং',
    myActiveListings: 'আমার চলমান ধান তালিকা',
    completedListings: 'সম্পন্ন লেনদেনসমূহ',
    dealsCount: 'লেনদেন',

    // Mill Dashboard
    millTitle: 'চালকল ড্যাশবোর্ড',
    availableListings: 'ক্রয়যোগ্য ধান তালিকা',
    myActiveBids: 'আমার চলমান দর প্রস্তাব',
    millRating: 'মিল রেটিং',
    totalDeals: 'মোট চুক্তি',
    placeBidBtn: 'যোগাযোগ ও দর প্রস্তাব',
    viewBidsBtn: 'চ্যাট ও দর ইতিহাস',
    transportIncluded: 'পরিবহন সুবিধাসহ',
    transportCost: 'পরিবহন খরচ',

    // Admin Panel
    adminTitle: 'অ্যাডমিন প্যানেল',
    governanceTitle: 'প্ল্যাটফর্ম পরিচালনা ও তদারকি',
    totalUsers: 'মোট ব্যবহারকারী',
    farmers: 'কৃষক',
    mills: 'চালকল সমূহ',
    auditRecords: 'অডিট রেকর্ডস',
    millManagement: 'চালকল চালনা ও পরিচালনা',
    millName: 'মিলের নাম',
    owner: 'মালিক',
    cards: 'কার্ড সমূহ',
    clean: 'কোনো কার্ড নেই',
    suspended: 'স্থগিত',
    status: 'অবস্থা',
    actions: 'অ্যাকশন',
    aiPriceFloors: 'এআই সর্বনিম্ন ধান মূল্য পরিচালনা',
    variety: 'ধানের জাত',
    season: 'মরশুম',
    baseMsp: 'সরকারি দাম (MSP)',
    aiFloor: 'এআই ফ্লোর',
    adminOverride: 'অ্যাডমিন ওভাররাইড',
    effectivePrice: 'কার্যকর মূল্য',
    auditTrail: 'অডিট লগ',
    issueCardBtn: 'কার্ড দিন',
    yellowCard: 'হলুদ কার্ড (সতর্কবার্তা)',
    redCard: 'লাল কার্ড (স্থগিত)',

    // Market Board
    marketTitle: 'পাবলিক বাজার বোর্ড',
    marketTagline: 'সরাসরি ধানের বাজার দর — স্বচ্ছ, উন্মুক্ত ও স্থায়ী',
    avgBidsListing: 'গড় বিড/লিস্টিং',
    recentTransactions: 'সাম্প্রতিক লেনদেন',
    priceTrend: 'দরের প্রবণতা',

    // Modals & Chat Drawer
    cancelBtn: 'বাতিল',
    confirmPlaceBid: 'দর প্রস্তাব নিশ্চিত করুন',
    createListingTitle: 'নতুন ধানের লিস্টিং তৈরি করুন',
    descriptionLabel: 'ধানের বিবরণ',
    askingPriceLabel: 'আপনার প্রত্যাশিত দাম (৳/মন) - ঐচ্ছিক',
    askingPricePlaceholder: 'ঐচ্ছিক',
    quantityLabel: 'পরিমাণ (মন)',
    expiresInLabel: 'তালিকার মেয়াদ (দিন)',
    cropDescriptionPlaceholder: 'ধানের গুণমান, আর্দ্রতা বা সংরক্ষণের বিবরণ লিখুন...',
    aiConfidence: 'এআই আত্মবিশ্বাস',
    aiExplanation: 'এআই বিশ্লেষণ বিবরণ',
    issueCardTitle: 'কার্ড জারির কারণ',
    reasonLabel: 'কারণ লিখুন',
    reasonPlaceholder: 'হলুদ/লাল কার্ড জারির কারণ স্পষ্টভাবে লিখুন...',

    // Auth Modal
    loginTitle: 'মোবাইল ওটিপি লগইন',
    phoneLabel: 'মোবাইল নম্বর লিখুন',
    phonePlaceholder: 'উদা: ০১৭১২৩৪৫০০১',
    sendOtp: 'ওটিপি কোড পাঠান',
    otpLabel: 'ওটিপি কোড লিখুন',
    otpPlaceholder: '৬ ডিজিটের কোড',
    verify: 'যাচাই করুন',
    changePhone: 'নম্বর পরিবর্তন করুন',
    otpSentMsg: 'আপনার মোবাইলে পাঠানো ওটিপি কোডটি লিখুন।',

    // New Features
    chat: 'চ্যাট ও মূল্য আলোচনা',
    chatSend: 'পাঠান',
    chatPlaceholder: 'বার্তা লিখুন...',
    offerPriceLabel: 'দর প্রস্তাব সংশোধন করুন (৳/মন)',
    negotiateBtn: 'চ্যাট করুন',
    millInventoryTitle: 'প্রক্রিয়াজাতকৃত চালের স্টক',
    addInventoryBtn: 'নতুন চাল স্টক যোগ করুন',
    deleteBtn: 'মুছে ফেলুন',
    disputesTitle: 'দামের বিরোধ নিষ্পত্তি',
    ruleBtn: 'মীমাংসা করুন',
    rulingLabel: 'নিষ্পত্তি রায় লিখুন',
    rulingPlaceholder: 'রায়ের বিবরণ...',
    finalPriceLabel: 'চূড়ান্ত দর (৳/মন)',
    govtPrices: 'সরকারি দাম',
    millCompliance: 'মিল বিশ্বস্ততা স্কোর',

    // Pricing Page
    pricingTitle: 'মূল্য পরিকল্পনা',
    pricingTagline: 'কৃষকের জন্য সম্পূর্ণ বিনামূল্যে। মিলারদের জন্য সুলভ মাসিক সদস্যতা।',
    pricingFreeTitle: 'ফ্রি টিয়ার',
    pricingFreeDesc: 'লিস্টিং দেখুন, যোগাযোগ করতে পারবেন না',
    pricingPaidTitle: 'পেইড মিল (৳৫০০/মাস)',
    pricingPaidDesc: 'আনলিমিটেড যোগাযোগ + পুশ নোটিফিকেশন',
    pricingFarmerTitle: 'কৃষক',
    pricingFarmerDesc: 'কোনো ফি নেই। কখনোই না।',
    txFeeTitle: 'লেনদেন ফি',
    txFeeDesc: 'মোট লেনদেনের ০.৫% — মিলের পেমেন্ট থেকে কেটে নেওয়া হয়',
    featuredTitle: 'ফিচার্ড লিস্টিং (শীঘ্রই আসছে)',
    featuredDesc: '৳৫০ দিয়ে লিস্টিং ৪৮ ঘণ্টা মিলের ফিডের শীর্ষে',
    noFarmerFees: 'কৃষকদের জন্য কোনো ফি নেই। কখনোই না।',

    // Admin Settings & Analytics
    settingsTitle: 'প্ল্যাটফর্ম সেটিংস',
    analyticsTitle: 'বিশ্লেষণ ও পরিসংখ্যান',
    saveBtn: 'সংরক্ষণ করুন',
    platformRevenue: 'প্ল্যাটফর্ম রেভিনিউ',
    transactionVolume: 'লেনদেনের পরিমাণ',
    complianceChart: 'মিল বিশ্বস্ততা তুলনা',
  },
  EN: {
    title: 'KrishiDam',
    market: 'Market',
    farmer: 'Farmer',
    mill: 'Mill',
    admin: 'Admin',
    login: 'Login',
    logout: 'Logout',
    tagline: 'Reverse Auction Platform for Fair Grain Prices',
    subTagline: 'The reverse auction platform where rice mills compete for farmer crops. AI-enforced fair prices, complete public records, and no middlemen.',
    enterFarmer: 'Farmer Dashboard',
    enterMill: 'Mill Dashboard',
    enterAdmin: 'Admin Panel',
    viewMarket: 'View Market',
    liveMarket: 'Live Market Prices',
    differenceTitle: 'Key Features',
    features: [
      { title: 'Reverse Auction', desc: 'Farmers list, mills bid. Competition drives the grain prices up, not down.' },
      { title: 'AI Price Floor', desc: 'No bid accepted below the AI-calculated fair price floor. Zero farmer exploitation.' },
      { title: 'Public Records', desc: 'Every bid, transaction, and audit log is transparently and permanently recorded.' },
      { title: 'Admin Governance', desc: 'Direct market oversight with yellow/red card warnings and suspensions.' }
    ],
    livePrices: 'Live Market Prices',
    activeFarmers: 'Active Farmers',
    activeMills: 'Active Mills',
    valueTraded: 'Value Traded',
    aiFairPrice: 'AI Fair Price',
    viewFullMarket: 'View Full Market',
    ctaHeading: 'Ready to Transform Rice Trading?',
    ctaSub: 'Join KrishiDam today — whether you grow rice or process it, the platform ensures fairness for all.',
    footerText: 'KrishiDam — Cloud Camp BD × Infinity AI BuildFest 2026',

    // Dashboards Common
    welcome: 'Welcome',
    completed: 'Completed',
    active: 'Active',
    pending: 'Pending',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    expired: 'Expired',
    maund: 'maund',
    grade: 'Grade',
    district: 'District',
    upazila: 'Upazila',
    expiresIn: 'Expires',
    days: 'days',
    bidsCount: 'Contact Requests',
    totalBids: 'Total Requests',
    aiFloorPrice: 'AI Floor Price',
    askingPrice: 'Asking Price',
    bestBid: 'Best Offer',
    totalValue: 'Total Value',
    noBids: 'No offers placed yet',
    actionAccept: 'Accept',
    actionReject: 'Reject',
    notes: 'Notes',

    // Farmer Dashboard
    farmerTitle: 'Farmer Dashboard',
    newListingBtn: 'New Listing',
    myActiveListings: 'My Active Listings',
    completedListings: 'Completed Deals',
    dealsCount: 'Deals',

    // Mill Dashboard
    millTitle: 'Mill Dashboard',
    availableListings: 'Available Grain Listings',
    myActiveBids: 'My Active Bids',
    millRating: 'Rating',
    totalDeals: 'Total Deals',
    placeBidBtn: 'Contact & Offer',
    viewBidsBtn: 'Chat & History',
    transportIncluded: 'Transport Included',
    transportCost: 'Transport Cost',

    // Admin Panel
    adminTitle: 'Admin Panel',
    governanceTitle: 'Platform Governance & Oversight',
    totalUsers: 'Total Users',
    farmers: 'Farmers',
    mills: 'Mills',
    auditRecords: 'Audit Records',
    millManagement: 'Mill Management',
    millName: 'Mill Name',
    owner: 'Owner',
    cards: 'Cards',
    clean: 'Clean Record',
    suspended: 'Suspended',
    status: 'Status',
    actions: 'Actions',
    aiPriceFloors: 'AI Price Floor Governance',
    variety: 'Variety',
    season: 'Season',
    baseMsp: 'Govt MSP',
    aiFloor: 'AI Floor',
    adminOverride: 'Admin Override',
    effectivePrice: 'Effective Price',
    auditTrail: 'Audit Trail',
    issueCardBtn: 'Issue Card',
    yellowCard: 'Yellow Card (Warning)',
    redCard: 'Red Card (Suspend)',

    // Market Board
    marketTitle: 'Public Market Board',
    marketTagline: 'Real-time rice market data — transparent, public, and permanent',
    avgBidsListing: 'Avg Bids/Listing',
    recentTransactions: 'Recent Transactions',
    priceTrend: 'Price Trend',

    // Modals & Chat Drawer
    cancelBtn: 'Cancel',
    confirmPlaceBid: 'Confirm Offer',
    createListingTitle: 'Create New Grain Listing',
    descriptionLabel: 'Crop Description',
    askingPriceLabel: 'Asking Price (৳/maund) - Optional',
    askingPricePlaceholder: 'Optional',
    quantityLabel: 'Quantity (maund)',
    expiresInLabel: 'Expires In (days)',
    cropDescriptionPlaceholder: 'Describe quality, storage conditions, moisture levels...',
    aiConfidence: 'AI Confidence',
    aiExplanation: 'AI Explanation',
    issueCardTitle: 'Reason for Card Issuance',
    reasonLabel: 'Reason',
    reasonPlaceholder: 'Describe the violation or compliance issue clearly...',

    // Auth Modal
    loginTitle: 'Mobile OTP Login',
    phoneLabel: 'Enter Mobile Number',
    phonePlaceholder: 'e.g. 01712345001',
    sendOtp: 'Send OTP Code',
    otpLabel: 'Enter OTP Code',
    otpPlaceholder: '6-digit code',
    verify: 'Verify',
    changePhone: 'Change Phone',
    otpSentMsg: 'Enter the OTP code sent to your mobile number.',

    // New Features
    chat: 'Negotiation Chat',
    chatSend: 'Send',
    chatPlaceholder: 'Type message...',
    offerPriceLabel: 'Revise Price Offer (৳/maund)',
    negotiateBtn: 'Negotiate',
    millInventoryTitle: 'Processed Stock Inventory',
    addInventoryBtn: 'Add Processed Stock',
    deleteBtn: 'Delete',
    disputesTitle: 'Disputes Panel',
    ruleBtn: 'Rule Dispute',
    rulingLabel: 'Ruling Details',
    rulingPlaceholder: 'Enter official ruling...',
    finalPriceLabel: 'Final Price (৳/maund)',
    govtPrices: 'Govt Prices',
    millCompliance: 'Mill Compliance Scoreboard',

    // Pricing Page
    pricingTitle: 'Pricing Plans',
    pricingTagline: 'Completely free for farmers. Affordable subscriptions for mills.',
    pricingFreeTitle: 'Free Tier',
    pricingFreeDesc: 'View listings, cannot send contact requests',
    pricingPaidTitle: 'Paid Mill (৳500/month)',
    pricingPaidDesc: 'Unlimited contact requests + push notifications',
    pricingFarmerTitle: 'Farmer',
    pricingFarmerDesc: 'No fees. Ever.',
    txFeeTitle: 'Transaction Fee',
    txFeeDesc: '0.5% of total transaction value — deducted from mill payment',
    featuredTitle: 'Featured Listing (Coming Soon)',
    featuredDesc: '৳50 to boost listing to top of mill feed for 48 hours',
    noFarmerFees: 'No fees for farmers. Ever.',

    // Admin Settings & Analytics
    settingsTitle: 'Platform Settings',
    analyticsTitle: 'Analytics & Insights',
    saveBtn: 'Save',
    platformRevenue: 'Platform Revenue',
    transactionVolume: 'Transaction Volume',
    complianceChart: 'Mill Compliance Comparison',
  }
}

export default function KrishiDam() {
  const [role, setRole] = useState<Role>('LANDING')
  const [lang, setLang] = useState<Lang>('BN')
  const [theme, setTheme] = useState<Theme>('light')
  const [listings, setListings] = useState<Listing[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [loading, setLoading] = useState(false)
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([])
  const [marketStats, setMarketStats] = useState<any | null>(null)
  const [adminStats, setAdminStats] = useState<Record<string, number> | null>(null)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [showBidModal, setShowBidModal] = useState(false)
  const [showNewListingModal, setShowNewListingModal] = useState(false)
  const [showCardModal, setShowCardModal] = useState(false)
  const [cardTarget, setCardTarget] = useState<{ userId: string; name: string } | null>(null)
  const [mills, setMills] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [priceFloors, setPriceFloors] = useState<any[]>([])
  const [bidFormData, setBidFormData] = useState({ price: '', notes: '', transport: false, transportCost: '' })
  const [listingFormData, setListingFormData] = useState({
    variety: 'BRRI dhan28', season: 'BORO', quantity: '', qualityGrade: 'A',
    description: '', district: 'Dinajpur', upazila: '', askingPrice: '',
    harvestDate: '', expiresIn: '7',
  })
  const [aiPriceResult, setAiPriceResult] = useState<Record<string, any> | null>(null)
  const [acceptingBidId, setAcceptingBidId] = useState<string | null>(null)

  // Auth States
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authTargetRole, setAuthTargetRole] = useState<Role>('FARMER')
  const [authUser, setAuthUser] = useState<any | null>(null)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [firebaseIdToken, setFirebaseIdToken] = useState<string>('')
  const [isRestoringSession, setIsRestoringSession] = useState(true)
  const [authForm, setAuthForm] = useState({
    phone: '',
    otp: '',
    step: 'phone', // phone | otp | register
    loading: false,
    error: '',
    name: '',
    district: '',
    upazila: '',
    millName: '',
    mockOtp: ''
  })

  // New states for negotiation drawer & inventories
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null)
  const [showNegotiationDrawer, setShowNegotiationDrawer] = useState(false)
  const [chatInputText, setChatInputText] = useState('')
  const [chatInputPrice, setChatInputPrice] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const sendingMessageRef = useRef(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [millInventories, setMillInventories] = useState<MillInventory[]>([])
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  const [inventoryFormData, setInventoryFormData] = useState({
    riceType: '', category: 'fine', quantityKg: '2000', pricePerKg: '65', notes: ''
  })
  const [adminDisputes, setAdminDisputes] = useState<any[]>([])
  const [selectedDispute, setSelectedDispute] = useState<any | null>(null)
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [adminRulingText, setAdminRulingText] = useState('')
  const [adminRulingPrice, setAdminRulingPrice] = useState('')

  // AI Features States
  const [aiComplaints, setAiComplaints] = useState<any[]>([])
  const [aiFraudData, setAiFraudData] = useState<any | null>(null)
  const [aiForecastData, setAiForecastData] = useState<any | null>(null)
  const [aiForecastSummaries, setAiForecastSummaries] = useState<any[]>([])
  const [aiInsights, setAiInsights] = useState<any[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [showNewComplaintModal, setShowNewComplaintModal] = useState(false)
  const [complaintForm, setComplaintForm] = useState({ title: '', description: '', targetUserId: '', transactionId: '', listingId: '', district: '', upazila: '' })
  const [viewingComplaint, setViewingComplaint] = useState<any | null>(null)
  const [showComplaintDetailsModal, setShowComplaintDetailsModal] = useState(false)
  const [adminNotesText, setAdminNotesText] = useState('')
  const [showMillHistoryModal, setShowMillHistoryModal] = useState(false)
  const [selectedMillForHistory, setSelectedMillForHistory] = useState<any | null>(null)
  const [millTransactionHistory, setMillTransactionHistory] = useState<any[]>([])
  const [millHistoryLoading, setMillHistoryLoading] = useState(false)

  // Hash Router States
  const [currentHash, setCurrentHash] = useState('#/')
  const [warningCards, setWarningCards] = useState<any[]>([])
  const [marketTab, setMarketTab] = useState<'prices' | 'inventories' | 'transactions'>('prices')
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [adminPriceForm, setAdminPriceForm] = useState({ variety: 'BRRI dhan28', season: 'Boro 2025', pricePer40kg: '' })
  const [platformSettings, setPlatformSettings] = useState<any[]>([])
  const [analyticsData, setAnalyticsData] = useState<any | null>(null)

  const t = TRANSLATIONS[lang]

  // Setup Theme on Mount (Always Force Light Mode)
  useEffect(() => {
    setTheme('light')
    document.documentElement.classList.remove('dark')
  }, [])

  // Firebase Auth State Listener - Restore session on page refresh
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setIsRestoringSession(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken()
          const phone = firebaseUser.phoneNumber

          if (!phone) {
            setIsRestoringSession(false)
            return
          }

          // Sync with backend to get user data
          const syncRes = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone,
              role: 'FARMER', // Will be overridden by existing user's role
              idToken: token
            })
          })

          if (syncRes.ok) {
            const userData = await syncRes.json()
            // Only restore if user exists in our database (not a new user)
            if (userData.id && userData.exists !== false) {
              setAuthUser(userData)
              setRole(userData.role as Role)
              setFirebaseIdToken(token)
            }
          }
        } catch (err) {
          console.error('Error restoring auth session:', err)
        } finally {
          setIsRestoringSession(false)
        }
      } else {
        // No Firebase user - not logged in
        setIsRestoringSession(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }, [])

  const fetchListings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/listings?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) {
        if (!silent) addToast('error', lang === 'BN' ? 'লিস্টিং লোড করতে ব্যর্থ হয়েছে' : 'Failed to load listings')
        return
      }
      const data = await res.json()
      if (Array.isArray(data)) {
        setListings(data)
      } else {
        if (!silent) addToast('error', lang === 'BN' ? 'লিস্টিং লোড করতে ব্যর্থ হয়েছে' : 'Failed to load listings')
      }
    } catch {
      if (!silent) addToast('error', lang === 'BN' ? 'লিস্টিং লোড করতে ব্যর্থ হয়েছে' : 'Failed to load listings')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [addToast, lang])

  const fetchMarketPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/market?action=latest-prices')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setMarketPrices(data)
    } catch { /* silently fail */ }
  }, [])

  const fetchMarketStats = useCallback(async () => {
    try {
      const res = await fetch('/api/market?action=stats')
      if (!res.ok) return
      const data = await res.json()
      if (data && typeof data === 'object' && !data.error) {
        setMarketStats(data)
      }
    } catch { /* silently fail */ }
  }, [])

  const fetchRecentTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/market?action=recent-transactions')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setRecentTransactions(data)
    } catch { /* silently fail */ }
  }, [])

  const fetchMillInventories = useCallback(async () => {
    try {
      const res = await fetch('/api/market?action=inventories')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setMillInventories(data)
    } catch { /* silently fail */ }
  }, [])

  const fetchAdminDisputes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin?action=disputes')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setAdminDisputes(data)
    } catch { /* silently fail */ }
  }, [])

  const fetchPlatformSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin?action=settings')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setPlatformSettings(data)
    } catch { /* silently fail */ }
  }, [])

  const fetchAnalyticsData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin?action=analytics')
      if (!res.ok) return
      const data = await res.json()
      if (data && typeof data === 'object' && !data.error) {
        setAnalyticsData(data)
      }
    } catch { /* silently fail */ }
  }, [])

  const fetchAdminData = useCallback(async () => {
    try {
      const [statsRes, millsRes, auditRes, priceRes, cardsRes] = await Promise.all([
        fetch('/api/admin?action=stats'),
        fetch('/api/admin?action=mills'),
        fetch('/api/admin?action=audit'),
        fetch('/api/admin?action=price-floors'),
        fetch('/api/admin?action=cards'),
      ])
      if (statsRes.ok) {
        const d = await statsRes.json()
        if (d && typeof d === 'object' && !d.error) setAdminStats(d)
      }
      if (millsRes.ok) {
        const d = await millsRes.json()
        if (Array.isArray(d)) setMills(d)
      }
      if (auditRes.ok) {
        const d = await auditRes.json()
        if (Array.isArray(d)) setAuditLogs(d)
      }
      if (priceRes.ok) {
        const d = await priceRes.json()
        if (Array.isArray(d)) setPriceFloors(d)
      }
      if (cardsRes.ok) {
        const d = await cardsRes.json()
        if (Array.isArray(d)) setWarningCards(d)
      }
    } catch {
      addToast('error', lang === 'BN' ? 'অ্যাডমিন ডাটা লোড করতে ব্যর্থ হয়েছে' : 'Failed to load admin data')
    }
  }, [addToast, lang])

  const fetchAiComplaints = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/complaints')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setAiComplaints(data)
    } catch { /* silently fail */ }
  }, [])

  const fetchAiFraud = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/fraud')
      if (!res.ok) return
      const data = await res.json()
      if (data && typeof data === 'object' && !data.error) setAiFraudData(data)
    } catch { /* silently fail */ }
  }, [])

  const fetchAiForecast = useCallback(async () => {
    try {
      const [forecastRes, summariesRes] = await Promise.all([
        fetch('/api/ai/forecast'),
        fetch('/api/ai/forecast?action=summaries'),
      ])
      if (forecastRes.ok) {
        const data = await forecastRes.json()
        if (data && typeof data === 'object' && !data.error) setAiForecastData(data)
      }
      if (summariesRes.ok) {
        const data = await summariesRes.json()
        if (Array.isArray(data)) setAiForecastSummaries(data)
      }
    } catch { /* silently fail */ }
  }, [])

  const fetchAiAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/analytics')
      if (!res.ok) return
      const data = await res.json()
      if (data && typeof data === 'object' && !data.error) {
        if (Array.isArray(data.insights)) setAiInsights(data.insights)
      }
    } catch { /* silently fail */ }
  }, [])

  const fetchAllAiData = useCallback(async () => {
    setAiLoading(true)
    await Promise.all([fetchAiComplaints(), fetchAiFraud(), fetchAiForecast(), fetchAiAnalytics()])
    setAiLoading(false)
  }, [fetchAiComplaints, fetchAiFraud, fetchAiForecast, fetchAiAnalytics])

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!complaintForm.title || !complaintForm.description || !authUser) return
    try {
      const res = await fetch('/api/ai/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create',
          title: complaintForm.title,
          description: complaintForm.description,
          filedBy: authUser.id,
          targetUserId: complaintForm.targetUserId || undefined,
          transactionId: complaintForm.transactionId || undefined,
          listingId: complaintForm.listingId || undefined,
          district: complaintForm.district || undefined,
          upazila: complaintForm.upazila || undefined,
        })
      })
      if (res.ok) {
        addToast('success', lang === 'BN' ? 'অভিযোগ সফলভাবে দায়ের করা হয়েছে' : 'Complaint filed successfully')
        setShowNewComplaintModal(false)
        setComplaintForm({ title: '', description: '', targetUserId: '', transactionId: '', listingId: '', district: '', upazila: '' })
        fetchAiComplaints()
      } else {
        const data = await res.json()
        addToast('error', data.error || 'Failed to file complaint')
      }
    } catch {
      addToast('error', 'Network error filing complaint')
    }
  }

  const handleUpdateComplaintStatus = async (complaintId: string, status: string, adminNotes?: string) => {
    if (!authUser) return
    try {
      const res = await fetch('/api/ai/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'update-status',
          complaintId,
          status,
          adminNotes,
          resolvedBy: authUser.id,
        })
      })
      if (res.ok) {
        addToast('success', lang === 'BN' ? 'অভিযোগের অবস্থা আপডেট করা হয়েছে' : 'Complaint status updated')
        fetchAiComplaints()
      } else {
        const data = await res.json()
        addToast('error', data.error || 'Failed to update status')
      }
    } catch {
      addToast('error', 'Network error updating complaint')
    }
  }

  const handleViewMillHistory = async (millId: string, millName: string) => {
    setMillHistoryLoading(true)
    setSelectedMillForHistory({ id: millId, name: millName })
    setShowMillHistoryModal(true)
    
    try {
      const res = await fetch(`/api/market?action=mill-transactions&millId=${millId}`)
      if (res.ok) {
        const data = await res.json()
        setMillTransactionHistory(data)
      } else {
        addToast('error', lang === 'BN' ? 'মিলের লেনদেন ইতিহাস লোড করতে ব্যর্থ' : 'Failed to load mill transaction history')
        setMillTransactionHistory([])
      }
    } catch (err) {
      console.error('Error fetching mill history:', err)
      addToast('error', lang === 'BN' ? 'মিলের লেনদেন ইতিহাস লোড করতে ব্যর্থ' : 'Failed to load mill transaction history')
      setMillTransactionHistory([])
    } finally {
      setMillHistoryLoading(false)
    }
  }

  // Admin Cards override handler
  const handleOverrideCard = async (cardId: string, reason: string) => {
    if (!authUser) return
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'OVERRIDE_CARD',
          adminId: authUser.id,
          cardId,
          reason
        })
      })
      if (res.ok) {
        addToast('success', lang === 'BN' ? 'কার্ডটি বাতিল করা হয়েছে এবং মিল প্রোফাইল সচল করা হয়েছে' : 'Warning card overridden and mill restored')
        fetchAdminData()
      } else {
        const data = await res.json()
        addToast('error', data.error || 'Failed to override card')
      }
    } catch {
      addToast('error', 'Network error overriding warning card')
    }
  }

  // Admin Mill Unsuspend handler
  const handleUnsuspendMill = async (targetUserId: string, reason: string) => {
    if (!authUser) return
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'UNSUSPEND_MILL',
          adminId: authUser.id,
          targetUserId,
          reason
        })
      })
      if (res.ok) {
        addToast('success', lang === 'BN' ? 'মিলের স্থগিতাদেশ সফলভাবে প্রত্যাহার করা হয়েছে' : 'Mill suspension lifted successfully')
        fetchAdminData()
      } else {
        const data = await res.json()
        addToast('error', data.error || 'Failed to unsuspend mill')
      }
    } catch {
      addToast('error', 'Network error unsuspending mill')
    }
  }

  // Admin Govt Reference Price create handler
  const handleCreateGovtPrice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authUser || !adminPriceForm.pricePer40kg) return
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PRICE_UPDATE',
          adminId: authUser.id,
          variety: adminPriceForm.variety,
          season: adminPriceForm.season,
          newPrice: parseFloat(adminPriceForm.pricePer40kg)
        })
      })
      if (res.ok) {
        addToast('success', lang === 'BN' ? 'সরকারি দাম সফলভাবে হালনাগাদ করা হয়েছে' : 'Government price successfully updated')
        setAdminPriceForm(prev => ({ ...prev, pricePer40kg: '' }))
        fetchAdminData()
      } else {
        const data = await res.json()
        addToast('error', data.error || 'Failed to update price')
      }
    } catch {
      addToast('error', 'Network error setting government price')
    }
  }

  // Setup Hash Route Listener and Protection
  useEffect(() => {
    const handleHashChange = () => {
      // Don't redirect if we're still restoring the session
      if (isRestoringSession) return

      const hash = window.location.hash || '#/'
      
      // Route protection checks
      if (hash.startsWith('#/farmer')) {
        if (!authUser) {
          setAuthTargetRole('FARMER')
          setShowAuthModal(true)
          window.location.hash = '#/'
          return
        }
        if (authUser.role !== 'FARMER') {
          addToast('error', lang === 'BN' ? 'আপনার অ্যাকাউন্টটি কৃষক অ্যাকাউন্ট নয়।' : 'Your account is not a Farmer account.')
          window.location.hash = authUser.role === 'MILL' ? '#/mill' : '#/admin'
          return
        }
        setRole('FARMER')
      } else if (hash.startsWith('#/mill')) {
        if (!authUser) {
          setAuthTargetRole('MILL')
          setShowAuthModal(true)
          window.location.hash = '#/'
          return
        }
        if (authUser.role !== 'MILL') {
          addToast('error', lang === 'BN' ? 'আপনার অ্যাকাউন্টটি চালকল অ্যাকাউন্ট নয়।' : 'Your account is not a Mill account.')
          window.location.hash = authUser.role === 'FARMER' ? '#/farmer' : '#/admin'
          return
        }
        setRole('MILL')
      } else if (hash.startsWith('#/admin')) {
        if (!authUser) {
          setAuthTargetRole('ADMIN')
          setShowAuthModal(true)
          window.location.hash = '#/'
          return
        }
        if (authUser.role !== 'ADMIN') {
          addToast('error', lang === 'BN' ? 'আপনার অ্যাকাউন্টটি অ্যাডমিন অ্যাকাউন্ট নয়।' : 'Your account is not an Admin account.')
          window.location.hash = authUser.role === 'FARMER' ? '#/farmer' : '#/mill'
          return
        }
        setRole('ADMIN')
      } else if (hash.startsWith('#/market')) {
        setRole('MARKET')
      } else if (hash.startsWith('#/pricing')) {
        setRole('PRICING')
      } else {
        setRole('LANDING')
      }
      
      setCurrentHash(hash)
    }

    window.addEventListener('hashchange', handleHashChange)
    handleHashChange()
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [authUser, lang, addToast, isRestoringSession])

  useEffect(() => {
    if (role === 'FARMER' || role === 'MILL') {
      fetchListings()
      fetchMillInventories()
    }
    if (role === 'MARKET' || role === 'LANDING') {
      fetchMarketPrices()
      fetchMarketStats()
      fetchMillInventories()
      fetchRecentTransactions()
    }
    if (role === 'ADMIN') {
      fetchAdminData()
      fetchAdminDisputes()
      fetchPlatformSettings()
      fetchAnalyticsData()
      fetchAllAiData()
    }
    if (role === 'MARKET') fetchListings()
    if (role === 'PRICING') fetchPlatformSettings()
  }, [role, fetchListings, fetchMarketPrices, fetchMarketStats, fetchAdminData, fetchMillInventories, fetchAdminDisputes, fetchRecentTransactions, fetchPlatformSettings, fetchAnalyticsData, fetchAllAiData])

  // Sync listings with selectedBid updates so that the dashboard reflects new messages/prices in real-time
  useEffect(() => {
    if (!selectedBid) return
    
    setListings(prevListings => {
      let updated = false
      const updatedListings = prevListings.map(listing => {
        if (listing.id === selectedBid.listingId && listing.bids) {
          const updatedBids = listing.bids.map((b: any) => {
            if (b.id === selectedBid.id) {
              const hasChanged = b.status !== selectedBid.status ||
                Number(b.pricePerMaund) !== Number(selectedBid.pricePerMaund) ||
                JSON.stringify(b.messages) !== JSON.stringify(selectedBid.messages)
              
              if (hasChanged) {
                updated = true
                return { ...b, ...selectedBid }
              }
            }
            return b
          })
          if (updated) {
            return { ...listing, bids: updatedBids }
          }
        }
        return listing
      })
      
      return updated ? updatedListings : prevListings
    })
  }, [selectedBid])

  // Calculate AI price when listing form changes
  useEffect(() => {
    if (!showNewListingModal && currentHash !== '#/farmer/post') return
    const { variety, season, qualityGrade, district } = listingFormData
    if (!variety || !season || !qualityGrade) return
    
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ variety, season, qualityGrade, district })
        const res = await fetch(`/api/price-engine?${params}`)
        const data = await res.json()
        setAiPriceResult(data)
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [showNewListingModal, listingFormData])

  // Helper to initialize reCAPTCHA verifier
  const getRecaptchaVerifier = () => {
    if (!auth) {
      throw new Error('Firebase Auth not initialized')
    }

    // Clear previous verifier if any to avoid rendering clashes
    if ((window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier.clear()
      } catch (e) {
        console.error('Error clearing old recaptcha verifier:', e)
      }
      (window as any).recaptchaVerifier = null
    }

    // Recreate fresh DOM container for reCAPTCHA widget
    const oldContainer = document.getElementById('recaptcha-container')
    if (oldContainer) {
      oldContainer.remove()
    }

    const container = document.createElement('div')
    container.id = 'recaptcha-container'
    document.body.appendChild(container)

    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
      'expired-callback': () => {
        // expired
      }
    });
    
    (window as any).recaptchaVerifier = verifier;
    return verifier;
  }

  // Phone OTP Auth handlers using Firebase Auth
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authForm.phone) return

    if (!isFirebaseConfigured || !auth) {
      setAuthForm(prev => ({
        ...prev,
        error: lang === 'BN'
          ? 'OTP সার্ভিস কনফিগার করা হয়নি। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।'
          : 'OTP service is not configured. Please contact the administrator.'
      }))
      return
    }

    setAuthForm(prev => ({ ...prev, loading: true, error: '' }))
    try {
      let formattedPhone = authForm.phone.trim()
      if (!formattedPhone.startsWith('+880') && !formattedPhone.startsWith('880')) {
        const cleanNumber = formattedPhone.replace(/^0+/, '')
        formattedPhone = `+880${cleanNumber}`
      } else if (formattedPhone.startsWith('880')) {
        formattedPhone = `+${formattedPhone}`
      }

      // Initialize reCAPTCHA
      const appVerifier = getRecaptchaVerifier()

      // Firebase Phone Auth
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier)
      setConfirmationResult(confirmation)

      setAuthForm(prev => ({
        ...prev,
        step: 'otp',
        phone: formattedPhone,
        loading: false
      }))
      addToast('success', lang === 'BN' ? 'ওটিপি পাঠানো হয়েছে' : 'OTP sent successfully')
    } catch (err: any) {
      console.error('Detailed Firebase Error:', err)
      let friendlyError = err.message
      if (err.code) {
        friendlyError = `[${err.code}]: ${err.message}`
        if (err.code === 'auth/unauthorized-domain') {
          friendlyError = `Unauthorized Domain (${err.code}): Please check if your localhost or IP is added to the Authorized Domains list in Firebase Console under Authentication -> Settings.`
        } else if (err.code === 'auth/operation-not-allowed') {
          friendlyError = `Phone Auth Disabled or Region Policy Blocked (${err.code}): Make sure Bangladesh (+880) is added to your SMS Region Policy in Firebase Settings.`
        } else if (err.code === 'auth/invalid-phone-number') {
          friendlyError = `Invalid Phone Number (${err.code}): The format of the phone number is invalid.`
        } else if (err.code === 'auth/quota-exceeded') {
          friendlyError = `SMS Quota Exceeded (${err.code}): The SMS quota for this project has been exceeded.`
        }
      }
      setAuthForm(prev => ({ ...prev, loading: false, error: friendlyError }))
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authForm.otp || !confirmationResult) return

    setAuthForm(prev => ({ ...prev, loading: true, error: '' }))
    try {
      // Confirm Firebase OTP
      const result = await confirmationResult.confirm(authForm.otp)
      const firebaseUser = result.user

      const verifiedPhone = firebaseUser.phoneNumber
      if (!verifiedPhone) {
        throw new Error('No phone number associated with this user')
      }

      // Retrieve Firebase ID Token
      const token = await firebaseUser.getIdToken()
      setFirebaseIdToken(token)

      const syncRes = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: verifiedPhone,
          role: authTargetRole,
          idToken: token
        })
      })
      if (!syncRes.ok) {
        const errorData = await syncRes.json()
        throw new Error(errorData.error || 'User synchronization failed')
      }
      const syncData = await syncRes.json()
      
      if (syncData.exists === false) {
        setAuthForm(prev => ({
          ...prev,
          step: 'register',
          phone: verifiedPhone, // Use verified number from firebase
          loading: false,
          error: ''
        }))
        return
      }

      setAuthUser(syncData)
      setRole(syncData.role as Role)
      setAuthForm({
        phone: '',
        otp: '',
        step: 'phone',
        loading: false,
        error: '',
        name: '',
        district: '',
        upazila: '',
        millName: '',
        mockOtp: ''
      })
      setConfirmationResult(null)
      setFirebaseIdToken('')
      setShowAuthModal(false)
      addToast('success', lang === 'BN' ? `স্বাগতম, ${syncData.name}` : `Welcome back, ${syncData.name}`)
    } catch (err: any) {
      console.error('Error verifying OTP:', err)
      setAuthForm(prev => ({ 
        ...prev, 
        loading: false, 
        error: err.code === 'auth/invalid-verification-code' 
          ? (lang === 'BN' ? 'ভুল ওটিপি কোড' : 'Incorrect OTP code') 
          : err.message 
      }))
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authForm.name || !authForm.district || !authForm.upazila) {
      setAuthForm(prev => ({ ...prev, error: lang === 'BN' ? 'সবগুলো তথ্য পূরণ করুন' : 'Please fill in all fields' }))
      return
    }
    if (authTargetRole === 'MILL' && !authForm.millName) {
      setAuthForm(prev => ({ ...prev, error: lang === 'BN' ? 'মিলের নাম লিখুন' : 'Please enter mill name' }))
      return
    }

    setAuthForm(prev => ({ ...prev, loading: true, error: '' }))
    try {
      const syncRes = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: authForm.phone,
          role: authTargetRole,
          name: authForm.name,
          district: authForm.district,
          upazila: authForm.upazila,
          millName: authForm.millName || undefined,
          idToken: firebaseIdToken
        })
      })
      if (!syncRes.ok) {
        const errorData = await syncRes.json()
        throw new Error(errorData.error || 'Registration failed')
      }
      const newUser = await syncRes.json()
      setAuthUser(newUser)
      setRole(newUser.role as Role)
      setAuthForm({
        phone: '',
        otp: '',
        step: 'phone',
        loading: false,
        error: '',
        name: '',
        district: '',
        upazila: '',
        millName: '',
        mockOtp: ''
      })
      setConfirmationResult(null)
      setFirebaseIdToken('')
      setShowAuthModal(false)
      addToast('success', lang === 'BN' ? `নিবন্ধন সফল হয়েছে! স্বাগতম, ${newUser.name}` : `Registration successful! Welcome, ${newUser.name}`)
    } catch (err: any) {
      setAuthForm(prev => ({ ...prev, loading: false, error: err.message }))
    }
  }

  const handleLogout = async () => {
    // Set restoring to false to prevent loading screen after logout
    setIsRestoringSession(false)

    // Sign out from Firebase
    if (isFirebaseConfigured && auth) {
      try {
        await signOut(auth)
      } catch (err) {
        console.error('Error signing out from Firebase:', err)
      }
    }

    // Clear local state
    setAuthUser(null)
    setRole('LANDING')
    setFirebaseIdToken('')
    setConfirmationResult(null)
    window.location.hash = '#/'
    addToast('success', lang === 'BN' ? 'সফলভাবে লগআউট করা হয়েছে' : 'Successfully logged out')
  }

  // Intercept dashboard actions to enforce auth
  const handleNavToRole = (targetRole: Role) => {
    if (targetRole === 'MARKET' || targetRole === 'LANDING') {
      setRole(targetRole)
      return
    }

    if (authUser && authUser.role === targetRole) {
      setRole(targetRole)
    } else {
      setAuthTargetRole(targetRole)
      setShowAuthModal(true)
    }
  }

  const handlePlaceBid = async () => {
    if (!selectedListing || !bidFormData.price || !authUser) return
    try {
      const res = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: selectedListing.id,
          millId: authUser.id,
          userId: authUser.id,
          pricePerMaund: parseFloat(bidFormData.price),
          notes: bidFormData.notes
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        addToast('error', data.error)
        return
      }
      addToast('success', lang === 'BN' 
        ? `দরপ্রস্তাব সফল হয়েছে: ৳${bidFormData.price}/মন`
        : `Bid placed successfully: ৳${bidFormData.price}/maund`)
      setShowBidModal(false)
      setBidFormData({ price: '', notes: '', transport: false, transportCost: '' })
      fetchListings()
    } catch {
      addToast('error', lang === 'BN' ? 'দরপ্রস্তাব করতে ব্যর্থ হয়েছে' : 'Failed to place bid')
    }
  }

  const handleCreateListing = async () => {
    if (!listingFormData.quantity || !authUser) {
      addToast('error', lang === 'BN' ? 'অনুগ্রহ করে সকল তথ্য পূরণ করুন' : 'Please fill in all required fields')
      return
    }
    
    // Use AI price if available, otherwise use a default floor price
    const floorPrice = aiPriceResult?.floorPrice || 1200
    
    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + parseInt(listingFormData.expiresIn))
      
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmerId: authUser.id,
          userId: authUser.id,
          variety: listingFormData.variety,
          season: listingFormData.season,
          quantityKg: parseFloat(listingFormData.quantity) * 40,
          qualityGrade: listingFormData.qualityGrade,
          description: listingFormData.description,
          aiFloorPrice: floorPrice,
          askingPrice: listingFormData.askingPrice ? parseFloat(listingFormData.askingPrice) : null,
          district: listingFormData.district,
          upazila: listingFormData.upazila,
          harvestDate: listingFormData.harvestDate || null,
          expiresAt: expiresAt.toISOString(),
        }),
      })
      if (res.ok) {
        addToast('success', lang === 'BN' ? 'ধানের লিস্টিং সফলভাবে তৈরি হয়েছে!' : 'Crop listing created successfully!')
        setShowNewListingModal(false)
        window.location.hash = '#/farmer/listings'
        fetchListings()
      } else {
        const errorData = await res.json()
        addToast('error', errorData.error || (lang === 'BN' ? 'লিস্টিং তৈরি করতে ব্যর্থ হয়েছে' : 'Failed to create listing'))
      }
    } catch (err) {
      console.error('Error creating listing:', err)
      addToast('error', lang === 'BN' ? 'লিস্টিং তৈরি করতে ব্যর্থ হয়েছে' : 'Failed to create listing')
    }
  }

  const handleAcceptBid = async (bidId: string) => {
    if (!authUser || acceptingBidId) return
    setAcceptingBidId(bidId)
    try {
      const res = await fetch('/api/bids', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId, action: 'ACCEPTED', userId: authUser.id }),
      })
      if (res.ok) {
        addToast('success', lang === 'BN' ? 'দরপ্রস্তাব গৃহীত হয়েছে! লেনদেন তৈরি করা হয়েছে।' : 'Bid accepted! Transaction created.')
        setShowNegotiationDrawer(false)
        fetchListings()
      } else {
        const errorData = await res.json()
        addToast('error', errorData.error || (lang === 'BN' ? 'দরপ্রস্তাব গ্রহণ করতে ব্যর্থ হয়েছে' : 'Failed to accept bid'))
      }
    } catch (err) {
      console.error('Error accepting bid:', err)
      addToast('error', lang === 'BN' ? 'দরপ্রস্তাব গ্রহণ করতে ব্যর্থ হয়েছে' : 'Failed to accept bid')
    } finally {
      setAcceptingBidId(null)
    }
  }

  const handleSendNegotiationMessage = async () => {
    if (!selectedBid || !chatInputText || !authUser || sendingMessageRef.current) return
    sendingMessageRef.current = true
    setSendingMessage(true)
    
    const trimmedText = chatInputText.trim()
    const priceVal = chatInputPrice ? parseFloat(chatInputPrice) : null
    
    // Create optimistic message with temporary ID
    const tempId = `temp-${Date.now()}`
    const optimisticMessage = {
      id: tempId,
      senderId: authUser.id,
      senderRole: role.toLowerCase(),
      message: trimmedText,
      priceOffered: priceVal,
      createdAt: new Date().toISOString()
    }
    
    // Immediately add to UI (optimistic update)
    setSelectedBid(prev => {
      if (!prev) return null
      return { 
        ...prev, 
        messages: [...(prev.messages || []), optimisticMessage]
      }
    })
    
    // Clear input immediately
    setChatInputText('')
    setChatInputPrice('')
    
    try {
      const res = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          requestId: selectedBid.id,
          senderId: authUser.id,
          senderRole: role.toLowerCase(),
          message: trimmedText,
          priceOffered: priceVal
        })
      })
      
      if (res.ok) {
        const newMsg = await res.json()
        addToast('success', lang === 'BN' ? 'বার্তা পাঠানো হয়েছে' : 'Message sent successfully')
        
        // Replace optimistic message with real one from server
        setSelectedBid(prev => {
          if (!prev) return null
          const updatedMsgs = (prev.messages || []).map(msg => 
            msg.id === tempId ? {
              id: newMsg.id,
              senderId: newMsg.senderId,
              senderRole: newMsg.senderRole,
              message: newMsg.message,
              priceOffered: newMsg.priceOffered ? Number(newMsg.priceOffered) : null,
              createdAt: newMsg.createdAt
            } : msg
          )
          
          // Deduplicate just in case pollMessages already inserted it
          const seenIds = new Set()
          const uniqueMsgs = updatedMsgs.filter(msg => {
            if (seenIds.has(msg.id)) return false
            seenIds.add(msg.id)
            return true
          })
          
          return { ...prev, messages: uniqueMsgs }
        })

        fetchListings(true)
      } else {
        // Remove optimistic message on error
        setSelectedBid(prev => {
          if (!prev) return null
          return {
            ...prev,
            messages: (prev.messages || []).filter(msg => msg.id !== tempId)
          }
        })
        
        const errorData = await res.json()
        addToast('error', errorData.error || (lang === 'BN' ? 'বার্তা পাঠাতে ব্যর্থ হয়েছে' : 'Failed to send message'))
      }
    } catch (err) {
      console.error('Error sending message:', err)
      
      // Remove optimistic message on error
      setSelectedBid(prev => {
        if (!prev) return null
        return {
          ...prev,
          messages: (prev.messages || []).filter(msg => msg.id !== tempId)
        }
      })
      
      addToast('error', lang === 'BN' ? 'বার্তা পাঠাতে ব্যর্থ হয়েছে' : 'Failed to send message')
    } finally {
      sendingMessageRef.current = false
      setSendingMessage(false)
    }
  }

  // Real-time chat polling - fetch new messages every 1.5 seconds when drawer is open
  useEffect(() => {
    if (!showNegotiationDrawer || !selectedBid) return

    const pollMessages = async () => {
      try {
        // Use the new efficient endpoint to fetch only this specific bid with cache bypassing
        const res = await fetch(`/api/bids?bidId=${selectedBid.id}&t=${Date.now()}`, { cache: 'no-store' })
        if (res.ok) {
          const currentBid = await res.json()
          
          if (currentBid && currentBid.messages) {
            // Use functional update to get latest state
            setSelectedBid(prev => {
              if (!prev) return null
              
              const incomingMessages = currentBid.messages || []
              const localMessages = prev.messages || []
              
              // We want to merge incoming database messages with local optimistic messages
              // without duplicates. Optimistic messages (starting with 'temp-') will be dropped
              // if a corresponding server message exists.
              const merged: any[] = [...incomingMessages]
              
              const tempMessages = localMessages.filter(msg => msg.id.startsWith('temp-'))
              for (const temp of tempMessages) {
                const alreadyReceived = incomingMessages.some((srv: any) => 
                  srv.senderId === temp.senderId &&
                  srv.message === temp.message &&
                  Math.abs(new Date(srv.createdAt).getTime() - new Date(temp.createdAt).getTime()) < 300000
                )
                if (!alreadyReceived) {
                  merged.push(temp)
                }
              }
              
              merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              
              const hasChanged = 
                prev.status !== currentBid.status ||
                prev.pricePerMaund !== currentBid.pricePerMaund ||
                JSON.stringify(prev.messages) !== JSON.stringify(merged)
              
              if (!hasChanged) return prev
              
              return { 
                ...prev, 
                status: currentBid.status, 
                pricePerMaund: currentBid.pricePerMaund,
                totalPrice: currentBid.totalPrice,
                messages: merged 
              }
            })
          }
        }
      } catch (err) {
        console.error('Error polling messages:', err)
      }
    }

    // Poll every 1.5 seconds for faster updates
    const interval = setInterval(pollMessages, 1500)
    
    // Also poll immediately when drawer opens
    pollMessages()

    return () => clearInterval(interval)
  }, [showNegotiationDrawer, selectedBid?.id])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current && selectedBid?.messages) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [selectedBid?.messages?.length])

  // Create processed rice inventory
  const handleCreateInventory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authUser) return
    try {
      const res = await fetch('/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-inventory',
          millId: authUser.id,
          riceType: inventoryFormData.riceType,
          category: inventoryFormData.category,
          quantityKg: parseInt(inventoryFormData.quantityKg) * 40,
          pricePerKg: parseFloat(inventoryFormData.pricePerKg),
          notes: inventoryFormData.notes
        })
      })
      if (res.ok) {
        addToast('success', lang === 'BN' ? 'চাল স্টক তালিকাভুক্ত করা হয়েছে' : 'Processed rice stock listed')
        setShowInventoryModal(false)
        setInventoryFormData({ riceType: '', category: 'fine', quantityKg: '2000', pricePerKg: '65', notes: '' })
        fetchMillInventories()
      } else {
        const errorData = await res.json()
        addToast('error', errorData.error || (lang === 'BN' ? 'স্টক তৈরি করতে ব্যর্থ হয়েছে' : 'Failed to create stock'))
      }
    } catch (err) {
      console.error('Error creating inventory:', err)
      addToast('error', lang === 'BN' ? 'স্টক তৈরি করতে ব্যর্থ হয়েছে' : 'Failed to create stock')
    }
  }

  const handleDeleteInventory = async (id: string) => {
    try {
      const res = await fetch('/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-inventory', id })
      })
      if (res.ok) {
        addToast('warning', lang === 'BN' ? 'স্টকটি মুছে ফেলা হয়েছে' : 'Stock deleted')
        fetchMillInventories()
      } else {
        const errorData = await res.json()
        addToast('error', errorData.error || (lang === 'BN' ? 'মুছে ফেলতে ব্যর্থ হয়েছে' : 'Failed to delete'))
      }
    } catch (err) {
      console.error('Error deleting inventory:', err)
      addToast('error', lang === 'BN' ? 'মুছে ফেলতে ব্যর্থ হয়েছে' : 'Failed to delete')
    }
  }

  // Resolve Price Dispute Ruling
  const handleRuleDispute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDispute || !adminRulingText || !adminRulingPrice || !authUser) return
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DISPUTE_RULE',
          adminId: authUser.id,
          revisionId: selectedDispute.id,
          ruling: adminRulingText,
          finalPrice: parseFloat(adminRulingPrice)
        })
      })
      if (res.ok) {
        addToast('success', lang === 'BN' ? 'বিরোধ নিষ্পত্তি সফল হয়েছে' : 'Dispute resolved successfully')
        setShowDisputeModal(false)
        setAdminRulingText('')
        setAdminRulingPrice('')
        fetchAdminDisputes()
        fetchAdminData()
      } else {
        const errorData = await res.json()
        addToast('error', errorData.error || (lang === 'BN' ? 'নিষ্পত্তি করতে ব্যর্থ হয়েছে' : 'Failed to resolve dispute'))
      }
    } catch (err) {
      console.error('Error resolving dispute:', err)
      addToast('error', lang === 'BN' ? 'নিষ্পত্তি করতে ব্যর্থ হয়েছে' : 'Failed to resolve dispute')
    }
  }

  const handleIssueCard = async (type: 'YELLOW_CARD' | 'RED_CARD' | 'GREEN_CARD', reason: string) => {
    if (!cardTarget || !authUser) return
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          adminId: authUser.id,
          targetUserId: cardTarget.userId,
          reason,
        }),
      })
      if (res.ok) {
        addToast('warning', lang === 'BN'
          ? `${cardTarget.name}-কে ${type === 'YELLOW_CARD' ? 'হলুদ কার্ড' : 'লাল কার্ড'} দেওয়া হয়েছে`
          : `${type === 'YELLOW_CARD' ? 'Yellow' : 'Red'} card issued to ${cardTarget.name}`)
        setShowCardModal(false)
        fetchAdminData()
      } else {
        const errorData = await res.json()
        addToast('error', errorData.error || (lang === 'BN' ? 'কার্ড দিতে ব্যর্থ হয়েছে' : 'Failed to issue card'))
      }
    } catch (err) {
      console.error('Error issuing card:', err)
      addToast('error', lang === 'BN' ? 'কার্ড দিতে ব্যর্থ হয়েছে' : 'Failed to issue card')
    }
  }

  const formatTaka = (n: any) => {
    if (n === null || n === undefined || isNaN(Number(n))) return '৳০'
    return `৳${Number(n).toLocaleString('en-BD')}`
  }
  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return lang === 'BN' ? `${mins} মিনিট আগে` : `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return lang === 'BN' ? `${hours} ঘণ্টা আগে` : `${hours}h ago`
    return lang === 'BN' ? `${Math.floor(hours / 24)} দিন আগে` : `${Math.floor(hours / 24)}d ago`
  }
  const daysLeft = (date: string) => {
    const diff = new Date(date).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  // Show loading screen while restoring session
  if (isRestoringSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary text-sm font-semibold">
            {lang === 'BN' ? 'সেশন পুনরুদ্ধার হচ্ছে...' : 'Restoring session...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-text-primary transition-colors duration-200">
      
      {/* Toast Notifications Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-custom shadow-md bg-surface border border-text-secondary/15 animate-slide-down">
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-success" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5 text-error" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-warning" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-info" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Navigation Bar */}
      <nav className="sticky top-0 z-40 bg-surface/95 border-b border-text-secondary/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button className="flex items-center gap-3 bg-transparent border-none cursor-pointer text-left" onClick={() => window.location.hash = '#/'}>
            <div className="w-10 h-10 rounded-custom bg-brand-green flex items-center justify-center text-white shadow-md">
              <Wheat className="w-5 h-5 text-background" />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight text-brand-green leading-none">{t.title}</div>
              <div className="text-[10px] text-text-secondary font-medium tracking-wide mt-1">কৃষক-চালকল সরাসরি সমবায়</div>
            </div>
          </button>

          <div className="flex items-center gap-4">
            {/* Show Market and Pricing only when NOT logged in */}
            {!authUser && (
              <>
                <button className="flex items-center gap-2 text-sm font-medium hover:text-brand-green transition-all bg-transparent border-none cursor-pointer" onClick={() => window.location.hash = '#/market'}>
                  <TrendingUp className="w-4 h-4 text-brand-green" /> {t.market}
                </button>
                <button className="flex items-center gap-2 text-sm font-medium hover:text-brand-green transition-all bg-transparent border-none cursor-pointer" onClick={() => window.location.hash = '#/pricing'}>
                  <CreditCard className="w-4 h-4 text-brand-green" /> {lang === 'BN' ? 'মূল্য' : 'Pricing'}
                </button>
              </>
            )}

            {/* Language Controls */}
            <div className="flex items-center gap-1 border-l border-text-secondary/20 pl-4">
              <button 
                onClick={() => setLang(l => l === 'BN' ? 'EN' : 'BN')}
                className="p-2 hover:bg-text-secondary/10 rounded-custom transition-all bg-transparent border-none cursor-pointer"
                title="Toggle Language"
              >
                <Languages className="w-4 h-4" />
              </button>
            </div>

            {/* Auth Session State */}
            {authUser ? (
              <div className="flex items-center gap-3 bg-background border border-text-secondary/10 py-1 px-3 rounded-custom">
                <div className="text-right">
                  <div className="text-xs font-semibold text-text-primary leading-tight">{lang === 'BN' && authUser.nameBn ? authUser.nameBn : authUser.name}</div>
                  <div className="text-[10px] text-text-secondary uppercase tracking-wider">{authUser.role}</div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-1.5 bg-text-secondary/10 hover:bg-danger/10 hover:text-danger rounded-custom transition-all border-none cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => { setAuthTargetRole('FARMER'); setShowAuthModal(true); }}
                className="flex items-center gap-2 bg-brand-green hover:bg-brand-dark text-background font-bold text-sm rounded-custom px-4 py-2 transition-all cursor-pointer border-none"
              >
                <Lock className="w-3.5 h-3.5 text-background" /> {t.login}
              </button>
            )}

            {/* Quick switcher (visible for logged-in users to toggle dashboard view) */}
            {authUser && (
              <div className="hidden md:flex bg-background border border-text-secondary/15 rounded-custom p-0.5">
                {([authUser.role] as Role[]).map(r => (
                  <button
                    key={r}
                    onClick={() => {
                      window.location.hash = r === 'FARMER' ? '#/farmer' : r === 'MILL' ? '#/mill' : '#/admin'
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-custom transition-all border-none cursor-pointer ${
                      currentHash.startsWith('#/' + r.toLowerCase()) 
                        ? 'bg-brand-green text-background' 
                        : 'hover:text-brand-green text-text-secondary bg-transparent'
                    }`}
                  >
                    {r === 'FARMER' ? t.farmer : r === 'MILL' ? t.mill : r === 'ADMIN' ? t.admin : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Live Market Price Ticker */}
      {(role === 'MARKET' || role === 'LANDING') && marketPrices.filter(mp => mp.currentPrice > 0).length > 0 && (
        <div className="w-full bg-brand-green/10 border-b border-text-secondary/10 overflow-hidden py-2.5 h-11 flex items-center">
          <div className="animate-marquee gap-8">
            {([...marketPrices.filter(mp => mp.currentPrice > 0), ...marketPrices.filter(mp => mp.currentPrice > 0)]).map((mp, i) => (
              <div key={i} className="flex items-center gap-2 text-sm font-semibold tracking-tight whitespace-nowrap">
                <span className="text-text-primary">{mp.variety}</span>
                <span className="text-brand-green font-mono">{formatTaka(mp.currentPrice)}</span>
                <span className={`flex items-center text-xs ${mp.change >= 0 ? 'text-success' : 'text-danger'}`}>
                  {mp.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(mp.changePercent).toFixed(1)}%
                </span>
                <span className="text-text-secondary/40">·</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ LANDING PAGE ═══ */}
      {role === 'LANDING' && (
        <div className="animate-fade-in">
          {/* Hero Section */}
          <div className="relative py-24 md:py-32 overflow-hidden bg-radial-gradient">
            <div className="max-w-7xl mx-auto px-6 relative z-10 text-center flex flex-col items-center gap-6">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-green/10 text-brand-green border border-brand-green/20 uppercase tracking-widest">
                Bangladesh Rice Auction Exchange
              </span>
              <h1 className="text-4xl md:text-6xl font-black max-w-4xl tracking-tight leading-tight">
                {t.tagline}
              </h1>
              <p className="text-text-secondary text-base md:text-lg max-w-2xl font-medium leading-relaxed">
                {t.subTagline}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
                <button className="bg-brand-green hover:bg-brand-dark text-background font-black text-sm rounded-custom px-6 py-3 shadow-lg cursor-pointer border-none" onClick={() => window.location.hash = '#/market'}>
                  {t.viewMarket}
                </button>
                {(!authUser || authUser.role === 'FARMER') && (
                  <button className="bg-surface hover:bg-text-secondary/10 border border-text-secondary/15 text-text-primary font-black text-sm rounded-custom px-6 py-3 cursor-pointer" onClick={() => window.location.hash = '#/farmer'}>
                    {t.enterFarmer}
                  </button>
                )}
                {(!authUser || authUser.role === 'MILL') && (
                  <button className="bg-surface hover:bg-text-secondary/10 border border-text-secondary/15 text-text-primary font-black text-sm rounded-custom px-6 py-3 cursor-pointer" onClick={() => window.location.hash = '#/mill'}>
                    {t.enterMill}
                  </button>
                )}
                {!authUser && (
                  <button className="bg-surface hover:bg-text-secondary/10 border border-text-secondary/15 text-text-primary font-black text-sm rounded-custom px-6 py-3 cursor-pointer" onClick={() => { setAuthTargetRole('ADMIN'); setShowAuthModal(true); }}>
                    {t.enterAdmin}
                  </button>
                )}
                {authUser?.role === 'ADMIN' && (
                  <button className="bg-surface hover:bg-text-secondary/10 border border-text-secondary/15 text-text-primary font-black text-sm rounded-custom px-6 py-3 cursor-pointer" onClick={() => window.location.hash = '#/admin'}>
                    {lang === 'BN' ? 'এডমিন ড্যাশবোর্ড' : 'Admin Dashboard'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="border-y border-text-secondary/10 bg-surface">
            <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 lg:grid-cols-4 gap-8">
              {(() => {
                const activePrices = marketPrices.filter(p => p.currentPrice > 0).map(p => p.currentPrice)
                const minPrice = activePrices.length > 0 ? Math.min(...activePrices) : 0
                const maxPrice = activePrices.length > 0 ? Math.max(...activePrices) : 0
                const livePricesRange = minPrice > 0 
                  ? `৳${minPrice.toLocaleString(lang === 'BN' ? 'bn-BD' : 'en-US')} - ৳${maxPrice.toLocaleString(lang === 'BN' ? 'bn-BD' : 'en-US')}`
                  : (lang === 'BN' ? 'কোনো তথ্য নেই' : 'No Data')

                const farmersCount = marketStats?.totalFarmers !== undefined
                  ? (lang === 'BN' ? `${marketStats.totalFarmers.toLocaleString('bn-BD')}+` : `${marketStats.totalFarmers}+`)
                  : '০+'
                const millsCount = marketStats?.totalMills !== undefined
                  ? (lang === 'BN' ? `${marketStats.totalMills.toLocaleString('bn-BD')}` : `${marketStats.totalMills}`)
                  : '০'
                const valueTraded = marketStats?.totalValue !== undefined && marketStats.totalValue > 0
                  ? `৳${marketStats.totalValue.toLocaleString(lang === 'BN' ? 'bn-BD' : 'en-US')}`
                  : '৳০'

                return [
                  { label: t.livePrices, value: livePricesRange, desc: lang === 'BN' ? 'মণ প্রতি' : 'per maund' },
                  { label: t.activeFarmers, value: farmersCount, desc: lang === 'BN' ? 'সরাসরি যুক্ত' : 'registered farmers' },
                  { label: t.activeMills, value: millsCount, desc: lang === 'BN' ? 'অংশগ্রহণকারী মিলার' : 'active rice mills' },
                  { label: t.valueTraded, value: valueTraded, desc: lang === 'BN' ? 'নিরাপদ লেনদেন' : 'total value traded' },
                ].map((stat, i) => (
                  <div key={i} className="text-center lg:text-left">
                    <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{stat.label}</div>
                    <div className="text-2xl md:text-3xl font-black text-brand-green mt-1 font-mono">{stat.value}</div>
                    <div className="text-xs text-text-secondary/70 font-semibold mt-1">{stat.desc}</div>
                  </div>
                ))
              })()}
            </div>
          </div>

          {/* Value Proposition */}
          <div className="max-w-7xl mx-auto px-6 py-24">
            <h2 className="text-3xl font-black text-center mb-16">{t.differenceTitle}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {t.features.map((f, i) => (
                <div key={i} className="bg-surface border border-text-secondary/10 rounded-custom p-6 shadow-sm hover:border-brand-green/20 transition-all flex flex-col gap-3">
                  <div className="w-10 h-10 rounded-custom bg-brand-green/10 text-brand-green flex items-center justify-center font-bold">
                    {i === 0 && <TrendingUp className="w-5 h-5" />}
                    {i === 1 && <Zap className="w-5 h-5" />}
                    {i === 2 && <Shield className="w-5 h-5" />}
                    {i === 3 && <Crown className="w-5 h-5" />}
                  </div>
                  <h3 className="text-lg font-black">{f.title}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <footer className="border-t border-text-secondary/10 bg-surface/50 py-8 text-center text-xs text-text-secondary font-semibold">
            {t.footerText}
          </footer>
        </div>
      )}

      {/* ═══ FARMER DASHBOARD ═══ */}
      {role === 'FARMER' && (
        <div className="max-w-7xl mx-auto px-6 py-8 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-black flex items-center gap-2"><Sprout className="w-8 h-8 text-brand-green" /> {t.farmerTitle}</h1>
              <p className="text-text-secondary mt-1 text-sm">{t.welcome}, <strong className="text-text-primary">{lang === 'BN' && authUser?.nameBn ? authUser.nameBn : authUser?.name || 'Farmer'}</strong></p>
            </div>
            {currentHash !== '#/farmer/post' && (
              <button 
                className="bg-brand-green hover:bg-brand-dark text-background font-black text-sm rounded-custom px-4 py-2.5 flex items-center gap-2 shadow-md cursor-pointer border-none" 
                onClick={() => window.location.hash = '#/farmer/post'}
              >
                <Plus className="w-4 h-4 text-background" /> {t.newListingBtn}
              </button>
            )}
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex gap-4 border-b border-text-secondary/15 pb-4 mb-6 overflow-x-auto">
            <button 
              onClick={() => window.location.hash = '#/farmer'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/farmer' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'ড্যাশবোর্ড ওভারভিউ' : 'Dashboard Overview'}
            </button>
            <button 
              onClick={() => window.location.hash = '#/farmer/post'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/farmer/post' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'ধান বিক্রির বিজ্ঞাপন' : 'Post Crop Listing'}
            </button>
            <button 
              onClick={() => window.location.hash = '#/farmer/listings'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/farmer/listings' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'আমার ধানের তালিকা' : 'My Crop Listings'}
            </button>
            <button 
              onClick={() => window.location.hash = '#/farmer/requests'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/farmer/requests' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'দরপ্রস্তাব সমূহ' : 'Mill Offers & Requests'}
            </button>
            <button 
              onClick={() => window.location.hash = '#/farmer/complaints'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/farmer/complaints' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'অভিযোগ' : 'Complaints'}
            </button>
          </div>

          {/* Sub View Contents */}
          {currentHash === '#/farmer/post' && (
            <div className="bg-surface border border-text-secondary/15 rounded-custom p-6 shadow-sm animate-slide-up flex flex-col gap-6 max-w-2xl mx-auto">
              <h2 className="text-xl font-black flex items-center gap-2"><Plus className="w-5 h-5 text-brand-green" /> {t.createListingTitle}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.variety}</label>
                  <select 
                    className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none cursor-pointer"
                    value={listingFormData.variety}
                    onChange={e => setListingFormData(prev => ({ ...prev, variety: e.target.value }))}
                  >
                    {['BRRI dhan28', 'BRRI dhan29', 'Miniket', 'Nazirshail', 'BRRI dhan49', 'Chinigura'].map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.season}</label>
                  <select 
                    className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none cursor-pointer"
                    value={listingFormData.season}
                    onChange={e => setListingFormData(prev => ({ ...prev, season: e.target.value }))}
                  >
                    {['BORO', 'AMAN', 'AUS'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.quantityLabel}</label>
                  <input 
                    type="number"
                    required
                    placeholder="উদা: ১০০"
                    value={listingFormData.quantity}
                    onChange={e => setListingFormData(prev => ({ ...prev, quantity: e.target.value }))}
                    className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm font-mono text-text-primary focus:border-brand-green outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.grade}</label>
                  <select 
                    className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none cursor-pointer"
                    value={listingFormData.qualityGrade}
                    onChange={e => setListingFormData(prev => ({ ...prev, qualityGrade: e.target.value }))}
                  >
                    {['A', 'B', 'C'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.district}</label>
                  <input 
                    type="text"
                    value={listingFormData.district}
                    onChange={e => setListingFormData(prev => ({ ...prev, district: e.target.value }))}
                    className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.upazila}</label>
                  <input 
                    type="text"
                    placeholder="উদা: বিরল"
                    value={listingFormData.upazila}
                    onChange={e => setListingFormData(prev => ({ ...prev, upazila: e.target.value }))}
                    className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.askingPriceLabel}</label>
                <input 
                  type="number"
                  placeholder={t.askingPricePlaceholder}
                  value={listingFormData.askingPrice}
                  onChange={e => setListingFormData(prev => ({ ...prev, askingPrice: e.target.value }))}
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm font-mono text-text-primary focus:border-brand-green outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.descriptionLabel}</label>
                <textarea 
                  placeholder={t.cropDescriptionPlaceholder}
                  value={listingFormData.description}
                  onChange={e => setListingFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none resize-none h-20"
                />
              </div>

              {aiPriceResult && (
                <div className="p-4 bg-brand-green/10 border border-brand-green/20 rounded-custom flex flex-col gap-1.5 animate-slide-up">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-brand-green flex items-center gap-1"><Zap className="w-3.5 h-3.5 fill-brand-green" /> {t.aiFairPrice}</span>
                    <span className="px-2 py-0.5 rounded bg-brand-green/20 text-brand-green text-[10px] font-bold uppercase">{t.aiConfidence}: {aiPriceResult.confidence}</span>
                  </div>
                  <div className="text-2xl font-black text-brand-green font-mono">{formatTaka(aiPriceResult.floorPrice)}<span className="text-xs font-semibold text-text-secondary ml-1">/{t.maund}</span></div>
                  <p className="text-[10px] text-text-secondary font-medium leading-relaxed mt-1">{aiPriceResult.explanation}</p>
                  <div className="text-[9.5px] text-text-secondary/80 font-semibold mt-1 font-mono">{aiPriceResult.timestamp}</div>
                </div>
              )}

              <button 
                className="w-full bg-brand-green hover:bg-brand-dark text-background font-bold text-sm py-2.5 rounded-custom transition-all shadow-md cursor-pointer border-none"
                onClick={handleCreateListing}
              >
                {t.newListingBtn}
              </button>
            </div>
          )}

          {currentHash === '#/farmer/listings' && (
            <div className="animate-slide-up flex flex-col gap-6">
              <h2 className="text-xl font-black flex items-center gap-2"><Package className="w-5 h-5 text-brand-green" /> {t.myActiveListings}</h2>
              <div className="flex flex-col gap-6">
                {listings.filter(l => l.farmer.id === authUser?.id).map(listing => (
                  <div key={listing.id} className="bg-surface border border-text-secondary/15 rounded-custom p-6 shadow-sm flex flex-col gap-6">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-lg font-black">{listing.variety}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border uppercase ${
                            listing.status?.toLowerCase() === 'active' ? 'bg-brand-green/10 text-brand-green border-brand-green/20' : 'bg-text-secondary/10 text-text-secondary border-text-secondary/20'
                          }`}>{listing.status}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-warning/10 text-warning border border-warning/20">{t.grade} {listing.qualityGrade}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-xs text-text-secondary font-semibold">
                          <span className="flex items-center gap-1"><Scale className="w-3.5 h-3.5" /> {listing.quantity} {t.maund} ({listing.quantityKg} kg)</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {listing.district}, {listing.upazila}</span>
                          <span className="flex items-center gap-1"><Wheat className="w-3.5 h-3.5" /> {listing.season}</span>
                          <span className="flex items-center gap-1 text-warning"><Clock className="w-3.5 h-3.5" /> {daysLeft(listing.expiresAt)} {t.days} {t.expiresIn}</span>
                        </div>
                      </div>
                      <div className="px-3 py-1.5 rounded-custom bg-info/10 text-info border border-info/20 text-xs font-bold flex items-center gap-1.5 font-mono">
                        <Gavel className="w-4 h-4 text-info" /> {listing.bids ? listing.bids.length : 0} {t.bidsCount}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4 border-y border-text-secondary/10">
                      <div>
                        <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{t.aiFloorPrice}</div>
                        <div className="text-xl font-black font-mono text-brand-green mt-1">{formatTaka(listing.aiFloorPrice)}</div>
                      </div>
                      {listing.askingPrice && (
                        <div>
                          <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{t.askingPrice}</div>
                          <div className="text-xl font-black font-mono text-warning mt-1">{formatTaka(listing.askingPrice)}</div>
                        </div>
                      )}
                      {listing.bids && listing.bids.length > 0 && (
                        <div className="col-span-2">
                          <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{t.bestBid}</div>
                          <div className="text-xl font-black font-mono text-info mt-1">
                            {formatTaka(listing.bids[0].pricePerMaund)}
                            <span className="text-xs font-semibold text-text-secondary ml-1.5 font-sans">
                              (Total: {formatTaka(listing.bids[0].totalPrice)})
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Offers under listing - sorted by mill reputation */}
                    {listing.bids && listing.bids.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                            {lang === 'BN' ? 'মিলের রেপুটেশন অনুযায়ী সাজানো:' : 'Sorted by Mill Reputation:'}
                          </span>
                          <span className="flex items-center gap-1 text-[10px]">
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">
                              <Award className="w-2.5 h-2.5" /> {lang === 'BN' ? 'সবচেয়ে ভালো' : 'Best'}
                            </span>
                            <span className="text-text-secondary">→</span>
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">
                              <AlertTriangle className="w-2.5 h-2.5" /> {lang === 'BN' ? 'মাঝারি' : 'Medium'}
                            </span>
                            <span className="text-text-secondary">→</span>
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-danger/10 text-danger border border-danger/20">
                              <Ban className="w-2.5 h-2.5" /> {lang === 'BN' ? 'ঝুঁকিপূর্ণ' : 'Risky'}
                            </span>
                          </span>
                        </div>
                        {[...listing.bids].sort((a, b) => {
                          // Sort by reputation: green cards first, then yellow, then red
                          // Higher green cards = better, higher red cards = worse
                          const aScore = (a.mill.greenCards || 0) * 3 - (a.mill.yellowCards || 0) * 1 - (a.mill.redCards || 0) * 2
                          const bScore = (b.mill.greenCards || 0) * 3 - (b.mill.yellowCards || 0) * 1 - (b.mill.redCards || 0) * 2
                          return bScore - aScore // Higher score first
                        }).map((bid) => (
                          <div key={bid.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-custom border bg-background border-text-secondary/10">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-custom flex items-center justify-center font-bold text-sm ${
                                (bid.mill.greenCards || 0) > 0 ? 'bg-success/10 text-success' :
                                (bid.mill.redCards || 0) > 0 ? 'bg-danger/10 text-danger' :
                                'bg-brand-green/10 text-brand-green'
                              }`}>
                                <Building2 className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleViewMillHistory(bid.mill.id, bid.mill.millName)}
                                    className="text-sm font-bold hover:text-brand-green hover:underline cursor-pointer bg-transparent border-none p-0 text-left"
                                    title={lang === 'BN' ? 'মিলের লেনদেন ইতিহাস দেখুন' : 'View mill transaction history'}
                                  >
                                    {bid.mill.millName}
                                  </button>
                                  {/* Card badges */}
                                  <div className="flex items-center gap-1">
                                    {(bid.mill.greenCards || 0) > 0 && (
                                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-success/10 text-success text-[10px] font-bold border border-success/20">
                                        <Award className="w-2.5 h-2.5" /> {bid.mill.greenCards}
                                      </span>
                                    )}
                                    {(bid.mill.yellowCards || 0) > 0 && (
                                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-warning/10 text-warning text-[10px] font-bold border border-warning/20">
                                        <AlertTriangle className="w-2.5 h-2.5" /> {bid.mill.yellowCards}
                                      </span>
                                    )}
                                    {(bid.mill.redCards || 0) > 0 && (
                                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-danger/10 text-danger text-[10px] font-bold border border-danger/20">
                                        <Ban className="w-2.5 h-2.5" /> {bid.mill.redCards}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-text-secondary font-bold">
                                  <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-warning fill-warning" /> {bid.mill.rating}</span>
                                  <span>·</span>
                                  <span>{bid.mill.totalDeals} {t.dealsCount}</span>
                                  <span>·</span>
                                  <span className="font-mono">Trust: {bid.mill.trustScore || bid.mill.rating * 20}%</span>
                                </div>
                                {bid.notes && <div className="text-[11px] text-text-secondary italic mt-1">&quot;{bid.notes}&quot;</div>}
                              </div>
                            </div>
                            <div className="flex items-center justify-between md:justify-end gap-4">
                              <div className="text-right">
                                <div className="text-base font-black font-mono text-brand-green">{formatTaka(bid.pricePerMaund)}/{t.maund}</div>
                                <div className="text-xs text-text-secondary font-mono">{t.totalValue}: {formatTaka(bid.totalPrice)}</div>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  className="bg-transparent border border-brand-green/40 hover:bg-brand-green/10 text-brand-green font-bold text-xs rounded-custom px-3 py-2 flex items-center gap-1 cursor-pointer"
                                  onClick={() => { setSelectedBid(bid); setShowNegotiationDrawer(true); }}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" /> {t.negotiateBtn}
                                </button>
                                {bid.status === 'PENDING' && (
                                  <button 
                                    className="bg-brand-green hover:bg-brand-dark text-background font-bold text-xs rounded-custom px-3.5 py-2 transition-all flex items-center gap-1 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => handleAcceptBid(bid.id)}
                                    disabled={acceptingBidId === bid.id}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-background" /> {acceptingBidId === bid.id ? (lang === 'BN' ? 'গ্রহণ করা হচ্ছে...' : 'Accepting...') : t.actionAccept}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-text-secondary italic">{t.noBids}</div>
                    )}
                  </div>
                ))}

                {listings.filter(l => l.farmer.id === authUser?.id).length === 0 && (
                  <div className="bg-surface border border-text-secondary/10 rounded-custom p-12 text-center">
                    <Package className="w-12 h-12 text-text-secondary/35 mx-auto mb-4" />
                    <h3 className="text-lg font-bold mb-1">{t.myActiveListings} নেই</h3>
                    <p className="text-sm text-text-secondary max-w-sm mx-auto mb-6">{t.noBids}</p>
                    <button className="bg-brand-green hover:bg-brand-dark text-background font-bold text-sm rounded-custom px-4 py-2 cursor-pointer border-none" onClick={() => window.location.hash = '#/farmer/post'}>
                      <Plus className="w-4 h-4 text-background" /> {t.newListingBtn}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentHash === '#/farmer/requests' && (
            <div className="animate-slide-up flex flex-col gap-4">
              <h2 className="text-xl font-black flex items-center gap-2"><Gavel className="w-5 h-5 text-brand-green" /> {t.bidsCount}</h2>
              <div className="flex flex-col gap-3">
                {listings.filter(l => l.farmer.id === authUser?.id).flatMap(l => l.bids ? l.bids.map(b => ({ ...b, listingRef: l })) : []).map(bid => (
                  <div key={bid.id} className="bg-surface border border-text-secondary/15 rounded-custom p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-custom bg-brand-green/10 text-brand-green flex items-center justify-center font-bold">
                        <Building2 className="w-5.5 h-5.5 text-brand-green" />
                      </div>
                      <div>
                        <div className="font-bold text-base">{bid.mill.millName}</div>
                        <div className="text-xs text-text-secondary mt-0.5">
                          {lang === 'BN' ? 'অনুরোধ ধানের জাত:' : 'Target variety:'} <strong className="text-text-primary">{bid.listingRef.variety}</strong> ({bid.listingRef.quantity} {t.maund})
                        </div>
                        {bid.notes && <div className="text-xs text-text-secondary italic mt-1.5">&quot;{bid.notes}&quot;</div>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6">
                      <div className="text-right">
                        <div className="text-lg font-black font-mono text-brand-green">{formatTaka(bid.pricePerMaund)}/{t.maund}</div>
                        <div className="text-xs text-text-secondary font-mono">{t.totalValue}: {formatTaka(bid.totalPrice)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          className="bg-transparent border border-brand-green/40 hover:bg-brand-green/10 text-brand-green font-bold text-xs rounded-custom px-3 py-2 flex items-center gap-1 cursor-pointer"
                          onClick={() => { setSelectedBid(bid); setShowNegotiationDrawer(true); }}
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> {t.negotiateBtn}
                        </button>
                        {bid.status === 'PENDING' && (
                          <button 
                            className="bg-brand-green hover:bg-brand-dark text-background font-bold text-xs rounded-custom px-3.5 py-2 transition-all flex items-center gap-1 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => handleAcceptBid(bid.id)}
                            disabled={acceptingBidId === bid.id}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-background" /> {acceptingBidId === bid.id ? (lang === 'BN' ? 'গ্রহণ করা হচ্ছে...' : 'Accepting...') : t.actionAccept}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {listings.filter(l => l.farmer.id === authUser?.id).reduce((sum, l) => sum + (l.bids ? l.bids.length : 0), 0) === 0 && (
                  <div className="bg-surface border border-text-secondary/10 rounded-custom p-12 text-center">
                    <Gavel className="w-12 h-12 text-text-secondary/35 mx-auto mb-4" />
                    <h3 className="text-lg font-bold mb-1">{t.noBids}</h3>
                    <p className="text-sm text-text-secondary max-w-sm mx-auto">মিল মালিকেরা দরপ্রস্তাব পাঠালে তা এই ইনবক্সে জমা হবে।</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Farmer Complaints View */}
          {currentHash === '#/farmer/complaints' && (
            <div className="animate-slide-up flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-danger" /> {lang === 'BN' ? 'আমার অভিযোগসমূহ' : 'My Complaints'}</h2>
                <button 
                  onClick={() => setShowNewComplaintModal(true)}
                  className="bg-danger hover:bg-danger/90 text-background font-bold text-sm rounded-custom px-4 py-2 flex items-center gap-2 shadow-md cursor-pointer border-none"
                >
                  <Plus className="w-4 h-4 text-background" /> {lang === 'BN' ? 'নতুন অভিযোগ' : 'New Complaint'}
                </button>
              </div>

              {/* My Complaints List */}
              <div className="flex flex-col gap-4">
                {aiComplaints.filter(c => c.filedBy === authUser?.id).length > 0 ? (
                  aiComplaints.filter(c => c.filedBy === authUser?.id).map((complaint: any) => (
                    <div key={complaint.id} className="bg-surface border border-text-secondary/15 rounded-custom p-5 shadow-sm flex flex-col gap-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                              complaint.aiCategory === 'fraud' ? 'bg-danger/10 text-danger border-danger/20' :
                              complaint.aiCategory === 'overpricing' ? 'bg-warning/10 text-warning border-warning/20' :
                              complaint.aiCategory === 'delivery_issue' ? 'bg-info/10 text-info border-info/20' :
                              complaint.aiCategory === 'product_quality' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                              'bg-text-secondary/10 text-text-secondary border-text-secondary/20'
                            }`}>{complaint.aiCategory || complaint.category}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              complaint.aiPriority === 'high' ? 'text-danger' :
                              complaint.aiPriority === 'medium' ? 'text-warning' :
                              'text-success'
                            }`}>{complaint.aiPriority || complaint.priority}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                              complaint.status === 'resolved' ? 'bg-success/10 text-success border-success/20' :
                              complaint.status === 'dismissed' ? 'bg-text-secondary/10 text-text-secondary border-text-secondary/20' :
                              complaint.status === 'under_review' ? 'bg-info/10 text-info border-info/20' :
                              'bg-warning/10 text-warning border-warning/20'
                            }`}>{complaint.status}</span>
                          </div>
                          <h3 className="font-bold text-base mb-1">{complaint.title}</h3>
                          <p className="text-xs text-text-secondary mb-2">{complaint.description}</p>
                          {complaint.aiSummary && (
                            <div className="bg-brand-green/5 border border-brand-green/20 rounded-custom p-3 mt-2">
                              <p className="text-xs text-brand-green font-semibold">{complaint.aiSummary}</p>
                            </div>
                          )}
                        </div>
                        <div className="ml-4 text-right">
                          <div className="text-xs text-text-secondary mb-1">{lang === 'BN' ? 'ঝুঁকি স্কোর' : 'Risk Score'}</div>
                          <div className={`text-2xl font-black font-mono ${
                            (complaint.aiFraudScore || 0) >= 70 ? 'text-danger' :
                            (complaint.aiFraudScore || 0) >= 40 ? 'text-warning' :
                            'text-success'
                          }`}>{complaint.aiFraudScore || 0}</div>
                        </div>
                      </div>
                      {complaint.aiSuggestion && (
                        <div className="border-t border-text-secondary/10 pt-3">
                          <p className="text-xs text-text-secondary"><strong>{lang === 'BN' ? 'পরামর্শ:' : 'Suggestion:'}</strong> {complaint.aiSuggestion}</p>
                        </div>
                      )}
                      <div className="text-xs text-text-secondary/70">
                        {lang === 'BN' ? 'দায়ের করা হয়েছে:' : 'Filed:'} {new Date(complaint.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-surface border border-text-secondary/10 rounded-custom p-12 text-center">
                    <AlertTriangle className="w-12 h-12 text-text-secondary/35 mx-auto mb-4" />
                    <h3 className="text-lg font-bold mb-1">{lang === 'BN' ? 'কোনো অভিযোগ নেই' : 'No Complaints Filed'}</h3>
                    <p className="text-sm text-text-secondary max-w-sm mx-auto mb-6">
                      {lang === 'BN' ? 'আপনি এখনো কোনো অভিযোগ দায়ের করেননি।' : 'You have not filed any complaints yet.'}
                    </p>
                    <button 
                      onClick={() => setShowNewComplaintModal(true)}
                      className="bg-danger hover:bg-danger/90 text-background font-bold text-sm rounded-custom px-4 py-2 flex items-center gap-2 shadow-md cursor-pointer border-none mx-auto"
                    >
                      <Plus className="w-4 h-4 text-background" /> {lang === 'BN' ? 'নতুন অভিযোগ দায়ের করুন' : 'File New Complaint'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {(currentHash === '#/farmer' || !['#/farmer/post', '#/farmer/listings', '#/farmer/requests', '#/farmer/complaints'].includes(currentHash)) && (
            <div className="animate-slide-up">
              {/* Farmer Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {[
                  { icon: <Package className="w-5 h-5 text-brand-green" />, value: listings.filter(l => l.farmer.id === authUser?.id).length, label: t.myActiveListings, color: 'text-brand-green bg-brand-green/10' },
                  { icon: <Gavel className="w-5 h-5 text-warning" />, value: listings.filter(l => l.farmer.id === authUser?.id).reduce((sum, l) => sum + (l.bids ? l.bids.length : 0), 0), label: t.totalBids, color: 'text-warning bg-warning/10' },
                  { icon: <CheckCircle2 className="w-5 h-5 text-success" />, value: listings.filter(l => l.farmer.id === authUser?.id && l.status?.toLowerCase() === 'sold').length, label: t.completedListings, color: 'text-success bg-success/10' },
                  { icon: <Activity className="w-5 h-5 text-info" />, value: listings.filter(l => l.farmer.id === authUser?.id && l.status?.toLowerCase() === 'active').length, label: t.active, color: 'text-info bg-info/10' },
                ].map((s, i) => (
                  <div key={i} className="bg-surface border border-text-secondary/10 rounded-custom p-6 shadow-sm flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-custom flex items-center justify-center ${s.color}`}>{s.icon}</div>
                    <div>
                      <div className="text-2xl font-black font-mono">{s.value}</div>
                      <div className="text-xs text-text-secondary font-bold uppercase tracking-wider mt-0.5">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Lists & Advisory widgets */}
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Active Listings overview */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  <h3 className="text-lg font-black">{t.myActiveListings} ({listings.filter(l => l.farmer.id === authUser?.id && l.status?.toLowerCase() === 'active').length})</h3>
                  <div className="flex flex-col gap-4">
                    {listings.filter(l => l.farmer.id === authUser?.id && l.status?.toLowerCase() === 'active').slice(0, 3).map(listing => (
                      <div key={listing.id} className="bg-surface border border-text-secondary/10 rounded-custom p-5 shadow-sm flex justify-between items-center flex-wrap gap-4">
                        <div>
                          <div className="font-bold text-sm text-text-primary">{listing.variety} ({listing.quantity} {t.maund})</div>
                          <div className="text-xs text-text-secondary mt-1 flex gap-3">
                            <span>{t.aiFloorPrice}: <strong className="text-brand-green font-mono">{formatTaka(listing.aiFloorPrice)}</strong></span>
                            <span>{t.bestBid}: <strong className="text-info font-mono">{listing.bids && listing.bids.length > 0 ? formatTaka(listing.bids[0].pricePerMaund) : 'N/A'}</strong></span>
                          </div>
                        </div>
                        <button 
                          className="bg-transparent border border-brand-green hover:bg-brand-green/10 text-brand-green text-xs font-bold px-3 py-1.5 rounded-custom cursor-pointer"
                          onClick={() => window.location.hash = '#/farmer/listings'}
                        >
                          {lang === 'BN' ? 'বিস্তারিত' : 'View Details'}
                        </button>
                      </div>
                    ))}
                    {listings.filter(l => l.farmer.id === authUser?.id && l.status?.toLowerCase() === 'active').length === 0 && (
                      <div className="bg-surface border border-text-secondary/10 rounded-custom p-6 text-center text-xs text-text-secondary italic">
                        {lang === 'BN' ? 'কোনো চলমান বিজ্ঞাপন নেই' : 'No active crop listings'}
                      </div>
                    )}
                  </div>
                </div>

                {/* AI advisory panel */}
                <div>
                  <div className="bg-brand-green/10 border border-brand-green/20 rounded-custom p-6 flex flex-col gap-3">
                    <h3 className="font-black text-lg text-brand-green flex items-center gap-2"><Zap className="w-5 h-5 text-brand-green" /> {lang === 'BN' ? 'এআই বাজার পরামর্শ' : 'AI Market Advisory'}</h3>
                    <p className="text-xs leading-relaxed text-text-secondary">
                      {lang === 'BN' 
                        ? 'দিনাজপুর অঞ্চলে বর্তমানে বোরো BRRI dhan28 ধানের চাহিদা তুঙ্গে রয়েছে। আর্দ্রতা ১৪% এর নিচে থাকলে মিলাররা ৫% পর্যন্ত বেশি দরপ্রস্তাব করতে আগ্রহী। ধান বেশি দিন মজুত না করে এখনই বিক্রির বিজ্ঞাপন দেওয়ার পরামর্শ দেওয়া হচ্ছে।' 
                        : 'Demand for Boro BRRI dhan28 in Dinajpur region is currently peaking. Millers are offering up to 5% higher bids for moisture levels below 14%. It is recommended to list now rather than hoarding.'}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-text-secondary mt-2">
                      <Clock className="w-4 h-4 text-text-secondary" /> {lang === 'BN' ? 'সর্বশেষ বিশ্লেষণ: আজ সকাল ১০:০০' : 'Last analyzed: Today 10:00 AM'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ MILL DASHBOARD ═══ */}
      {role === 'MILL' && (
        <div className="max-w-7xl mx-auto px-6 py-8 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-black flex items-center gap-2"><Factory className="w-8 h-8 text-brand-green" /> {t.millTitle}</h1>
              <p className="text-text-secondary mt-1 text-sm">
                <strong className="text-text-primary">Rashid Auto Rice Mill</strong> — Narayanganj · 
                <span className="inline-flex items-center gap-1 ml-2 text-warning"><Star className="w-3.5 h-3.5 fill-warning" /> 4.5</span> · 127 deals
              </p>
            </div>
            {currentHash === '#/mill/inventory' && (
              <button className="bg-brand-green hover:bg-brand-dark text-background font-black text-sm rounded-custom px-4 py-2.5 flex items-center gap-2 shadow-md cursor-pointer border-none" onClick={() => setShowInventoryModal(true)}>
                <Plus className="w-4 h-4 text-background" /> {t.addInventoryBtn}
              </button>
            )}
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex gap-4 border-b border-text-secondary/15 pb-4 mb-6 overflow-x-auto">
            <button 
              onClick={() => window.location.hash = '#/mill'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/mill' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'ড্যাশবোর্ড ওভারভিউ' : 'Overview'}
            </button>
            <button 
              onClick={() => window.location.hash = '#/mill/feed'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/mill/feed' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'ধানের ফিড' : 'Browse Paddy Feed'}
            </button>
            <button 
              onClick={() => window.location.hash = '#/mill/requests'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/mill/requests' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'আমার দরপ্রস্তাবসমূহ' : 'My Sent Bids'}
            </button>
            <button 
              onClick={() => window.location.hash = '#/mill/inventory'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/mill/inventory' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'চাল স্টক পরিচালনা' : 'Processed Rice Stock'}
            </button>
          </div>

          {/* Warning Banner about the warning card system */}
          {warningCards.filter(c => c.millId === authUser?.id && !c.overridden).length > 0 && (
            <div className="mb-8 p-5 bg-danger/10 border border-danger/20 rounded-custom flex flex-col gap-3 animate-slide-up">
              <div className="flex items-center gap-2 font-black text-danger">
                <AlertTriangle className="w-5.5 h-5.5 text-danger" />
                <span>{lang === 'BN' ? 'সতর্কতা: আপনার মিলের বিরুদ্ধে সক্রিয় কার্ড রয়েছে!' : 'Warning: Active Card Violations on your Mill Profile!'}</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed font-medium">
                {lang === 'BN' 
                  ? `আপনার চালকল প্রোফাইলে বর্তমানে সক্রিয় হলুদ/লাল কার্ড রয়েছে। মনে রাখবেন: ধানের চুক্তিবদ্ধ মূল্যের চেয়ে কম মূল্য পরিশোধ করলে (Price revisions) স্বয়ংক্রিয়ভাবে হলুদ কার্ড ইস্যু হয়। ৩০ দিনের মধ্যে ৩টি হলুদ কার্ড জমা হলে আপনার মিলটি স্বয়ংক্রিয়ভাবে স্থগিত (Suspended) হয়ে যাবে এবং আর দরপ্রস্তাব করতে পারবেন না।` 
                  : `Your mill profile currently has active warnings. Note: revising transaction price downwards at delivery will trigger an automatic yellow card. Accumulating 3 yellow cards in 30 days results in automatic suspension.`}
              </p>
              <div className="flex flex-col gap-2 mt-2">
                {warningCards.filter(c => c.millId === authUser?.id && !c.overridden).map((c: any) => (
                  <div key={c.id} className="text-xs p-2.5 bg-background border border-danger/10 rounded-custom flex items-center justify-between">
                    <span>
                      <strong className="text-danger uppercase font-mono">[{c.cardType}]</strong> - {c.description}
                    </span>
                    <span className="font-mono text-text-secondary/60 text-[10px]">{timeAgo(c.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub View Router switcher */}
          {currentHash === '#/mill/feed' && (
            <div className="animate-slide-up flex flex-col gap-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-black">{t.availableListings}</h2>
              </div>
              <div className="flex flex-col gap-4">
                {listings.filter(l => l.status?.toLowerCase() === 'active').map(listing => {
                  const myBid = listing.bids ? listing.bids.find(b => b.mill.id === authUser?.id) : null
                  return (
                    <div key={listing.id} className="bg-surface border border-text-secondary/15 rounded-custom p-6 shadow-sm flex flex-col gap-4">
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-lg font-black">{listing.variety}</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-green/10 text-brand-green border border-brand-green/20 uppercase">{listing.season}</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-warning/10 text-warning border border-warning/20">{t.grade} {listing.qualityGrade}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-xs text-text-secondary font-semibold">
                            <span className="flex items-center gap-1"><Leaf className="w-3.5 h-3.5" /> {listing.farmer.user.name}</span>
                            <span className="flex items-center gap-1"><Scale className="w-3.5 h-3.5" /> {listing.quantity} {t.maund}</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {listing.district}</span>
                            <span className="flex items-center gap-1 text-warning"><Clock className="w-3.5 h-3.5" /> {daysLeft(listing.expiresAt)} {t.days} {t.expiresIn}</span>
                          </div>
                          <div className="mt-3 p-2 bg-brand-green/5 border border-brand-green/10 rounded-custom flex items-center gap-2 text-[11px] font-semibold text-brand-green">
                            <Zap className="w-3.5 h-3.5 text-brand-green" />
                            <span>AI Match Score: 94% · High local relevance based on harvest moisture.</span>
                          </div>
                        </div>
                      </div>
                      {listing.description && (
                        <p className="text-xs text-text-secondary leading-relaxed">{listing.description}</p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 py-4 border-t border-text-secondary/10 items-end">
                        <div>
                          <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{t.aiFloorPrice}</div>
                          <div className="text-xl font-black font-mono text-brand-green mt-1">{formatTaka(listing.aiFloorPrice)}</div>
                        </div>
                        {listing.askingPrice && (
                          <div>
                            <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{t.askingPrice}</div>
                            <div className="text-xl font-black font-mono text-warning mt-1">{formatTaka(listing.askingPrice)}</div>
                          </div>
                        )}
                        <div>
                          <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{t.totalValue} ({t.aiFloorPrice})</div>
                          <div className="text-lg font-black font-mono mt-1 text-text-primary">
                            {formatTaka(listing.aiFloorPrice * listing.quantity)}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        {myBid ? (
                          <button className="bg-transparent border border-brand-green hover:bg-brand-green/10 text-brand-green text-xs font-bold rounded-custom px-4 py-2 flex items-center gap-1.5 transition-all cursor-pointer" onClick={() => { setSelectedBid(myBid); setShowNegotiationDrawer(true); }}>
                            <MessageSquare className="w-4 h-4" /> {t.viewBidsBtn}
                          </button>
                        ) : (
                          <button className="bg-brand-green hover:bg-brand-dark text-background text-xs font-bold rounded-custom px-4 py-2 flex items-center gap-1.5 transition-all shadow-md cursor-pointer border-none" onClick={() => { setSelectedListing(listing); setShowBidModal(true); }}>
                            <Send className="w-4 h-4 text-background" /> {t.placeBidBtn}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {listings.filter(l => l.status?.toLowerCase() === 'active').length === 0 && (
                  <div className="bg-surface border border-text-secondary/10 rounded-custom p-12 text-center">
                    <Package className="w-12 h-12 text-text-secondary/35 mx-auto mb-4" />
                    <h3 className="text-lg font-bold mb-1">{t.availableListings} নেই</h3>
                    <p className="text-sm text-text-secondary max-w-sm mx-auto">বর্তমানে বিক্রির জন্য কোনো ধানের লিস্টিং নেই।</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentHash === '#/mill/requests' && (
            <div className="animate-slide-up flex flex-col gap-4">
              <h2 className="text-xl font-black">{t.myActiveBids}</h2>
              <div className="flex flex-col gap-3">
                {listings.filter(l => l.bids && l.bids.some(b => b.mill.id === authUser?.id)).map(listing => {
                  const myBid = listing.bids.find(b => b.mill.id === authUser?.id)!
                  return (
                    <div key={myBid.id} className="bg-surface border border-text-secondary/15 rounded-custom p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="font-bold text-base text-text-primary">{listing.variety}</div>
                        <div className="text-xs text-text-secondary mt-1 flex gap-4">
                          <span>{t.grade}: <strong>{listing.qualityGrade}</strong></span>
                          <span>{t.quantityLabel}: <strong>{listing.quantity} {t.maund}</strong></span>
                          <span>{t.status}: <strong className="uppercase">{myBid.status}</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-6">
                        <div className="text-right">
                          <div className="text-lg font-black font-mono text-brand-green">{formatTaka(myBid.pricePerMaund)}/{t.maund}</div>
                          <div className="text-xs text-text-secondary font-mono">{t.totalValue}: {formatTaka(myBid.totalPrice)}</div>
                        </div>
                        <button 
                          className="bg-transparent border border-brand-green hover:bg-brand-green/10 text-brand-green text-xs font-bold px-4 py-2 rounded-custom flex items-center gap-1.5 transition-all cursor-pointer"
                          onClick={() => { setSelectedBid(myBid); setShowNegotiationDrawer(true); }}
                        >
                          <MessageSquare className="w-4 h-4" /> {t.viewBidsBtn}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {listings.filter(l => l.bids && l.bids.some(b => b.mill.id === authUser?.id)).length === 0 && (
                  <div className="bg-surface border border-text-secondary/10 rounded-custom p-12 text-center">
                    <Gavel className="w-12 h-12 text-text-secondary/35 mx-auto mb-4" />
                    <h3 className="text-lg font-bold mb-1">{t.myActiveBids} নেই</h3>
                    <p className="text-sm text-text-secondary max-w-sm mx-auto">ধানের ফিড থেকে দরপ্রস্তাব ও যোগাযোগ করুন।</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentHash === '#/mill/inventory' && (
            <div className="animate-slide-up flex flex-col gap-6">
              <h2 className="text-xl font-black">{t.millInventoryTitle}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {millInventories.filter(inv => inv.millId === authUser?.id).map(inv => (
                  <div key={inv.id} className="bg-surface border border-text-secondary/10 rounded-custom p-6 shadow-sm flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-black text-lg text-text-primary">{inv.riceType}</h3>
                        <span className="px-2 py-0.5 rounded bg-brand-green/10 text-brand-green text-xs font-bold border border-brand-green/20 uppercase">{inv.category}</span>
                      </div>
                      <div className="text-xs text-text-secondary mt-2 flex flex-col gap-1.5">
                        <span>Quantity: <strong>{inv.quantityMaund} {t.maund}</strong></span>
                        <span>Price: <strong>{formatTaka(inv.pricePerKg)}/kg</strong> ({formatTaka(inv.pricePerMaund)}/maund)</span>
                        {inv.notes && <span className="italic mt-1 text-text-secondary/80">&quot;{inv.notes}&quot;</span>}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteInventory(inv.id)}
                      className="w-full py-2 bg-danger/10 hover:bg-danger/20 text-danger text-xs font-bold rounded-custom flex items-center justify-center gap-1 border-none cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {t.deleteBtn}
                    </button>
                  </div>
                ))}
                <div className="border-2 border-dashed border-text-secondary/20 hover:border-brand-green/40 rounded-custom p-8 text-center flex flex-col items-center justify-center gap-3 cursor-pointer min-h-[170px]" onClick={() => setShowInventoryModal(true)}>
                  <Plus className="w-8 h-8 text-text-secondary" />
                  <span className="font-bold text-xs text-text-secondary">{t.addInventoryBtn}</span>
                </div>
              </div>
            </div>
          )}

          {(currentHash === '#/mill' || !['#/mill/feed', '#/mill/requests', '#/mill/inventory'].includes(currentHash)) && (
            <div className="animate-slide-up">
              {/* Stats row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {[
                  { icon: <Package className="w-5 h-5 text-brand-green" />, value: listings.filter(l => l.status?.toLowerCase() === 'active').length, label: t.availableListings, color: 'text-brand-green bg-brand-green/10' },
                  { icon: <Gavel className="w-5 h-5 text-warning" />, value: listings.filter(l => l.bids && l.bids.some(b => b.mill.id === authUser?.id)).length, label: t.myActiveBids, color: 'text-warning bg-warning/10' },
                  { icon: <Star className="w-5 h-5 text-success" />, value: '4.5', label: t.millRating, color: 'text-success bg-success/10' },
                  { icon: <CheckCircle2 className="w-5 h-5 text-info" />, value: '127', label: t.totalDeals, color: 'text-info bg-info/10' },
                ].map((s, i) => (
                  <div key={i} className="bg-surface border border-text-secondary/10 rounded-custom p-6 shadow-sm flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-custom flex items-center justify-center ${s.color}`}>{s.icon}</div>
                    <div>
                      <div className="text-2xl font-black font-mono">{s.value}</div>
                      <div className="text-xs text-text-secondary font-bold uppercase tracking-wider mt-0.5">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-3 gap-8">
                {/* Recent activity list */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  <h3 className="text-lg font-black">{lang === 'BN' ? 'চলমান বিডিং কার্যক্রম' : 'My Bidding Activity'}</h3>
                  <div className="flex flex-col gap-4">
                    {listings.filter(l => l.bids && l.bids.some(b => b.mill.id === authUser?.id)).slice(0, 3).map(l => {
                      const myBid = l.bids.find(b => b.mill.id === authUser?.id)!
                      return (
                        <div key={myBid.id} className="bg-surface border border-text-secondary/10 rounded-custom p-5 shadow-sm flex justify-between items-center flex-wrap gap-4">
                          <div>
                            <div className="font-bold text-sm text-text-primary">{l.variety} ({l.quantity} {t.maund})</div>
                            <div className="text-xs text-text-secondary mt-1">
                              {lang === 'BN' ? 'বিড মূল্য:' : 'Offered price:'} <strong className="text-brand-green font-mono">{formatTaka(myBid.pricePerMaund)}</strong> · Status: <span className="uppercase font-semibold">{myBid.status}</span>
                            </div>
                          </div>
                          <button 
                            className="bg-transparent border border-brand-green hover:bg-brand-green/10 text-brand-green text-xs font-bold px-3 py-1.5 rounded-custom cursor-pointer"
                            onClick={() => window.location.hash = '#/mill/requests'}
                          >
                            {lang === 'BN' ? 'চ্যাট করুন' : 'Open Chat'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Mill guidelines */}
                <div>
                  <div className="bg-surface border border-text-secondary/10 rounded-custom p-6 flex flex-col gap-3">
                    <h3 className="font-black text-lg text-brand-green flex items-center gap-1.5"><Shield className="w-5 h-5 text-brand-green" /> {lang === 'BN' ? 'বিশ্বস্ততা ও রেটিং নির্দেশিকা' : 'Trust Score Regulations'}</h3>
                    <p className="text-xs leading-relaxed text-text-secondary">
                      {lang === 'BN' 
                        ? 'মিলারদের রেটিং সর্বদা ৯০% এর উপরে রাখা বাঞ্ছনীয়। ধানের ওজন ও আর্দ্রতা সঠিকভাবে পরীক্ষা করে ন্যায্য মূল্যে লেনদেন সম্পন্ন করুন। অন্যায্য দাম হ্রাস ও অসদাচরণের জন্য এডমিন হলুদ কার্ড জারি করতে পারে।' 
                        : 'Milers are advised to keep their Trust Score above 90%. Fair payment and accurate moisture assessment on arrival build farmer trust. Admin enforces rules stringently.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ ADMIN PANEL ═══ */}
      {role === 'ADMIN' && adminStats && (
        <div className="max-w-7xl mx-auto px-6 py-8 animate-fade-in">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-black flex items-center gap-2"><Shield className="w-8 h-8 text-brand-green" /> {t.adminTitle}</h1>
            <p className="text-text-secondary mt-1 text-sm">{t.governanceTitle} — <strong className="text-text-primary">Kamal Hossain</strong></p>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex gap-4 border-b border-text-secondary/15 pb-4 mb-6 overflow-x-auto">
            <button 
              onClick={() => window.location.hash = '#/admin'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/admin' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'ড্যাশবোর্ড ওভারভিউ' : 'Overview'}
            </button>
            <button 
              onClick={() => window.location.hash = '#/admin/prices'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/admin/prices' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'সরকারি দাম ও ফ্লোর' : 'Govt Prices & Floors'}
            </button>
            <button 
              onClick={() => window.location.hash = '#/admin/cards'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/admin/cards' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'সতর্কীকরণ কার্ড ও স্থগিত' : 'Mill Warning Cards'}
            </button>
            <button 
              onClick={() => window.location.hash = '#/admin/disputes'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/admin/disputes' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'দামের বিরোধ নিষ্পত্তি' : 'Price Disputes'}
            </button>
            <button 
              onClick={() => window.location.hash = '#/admin/settings'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/admin/settings' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'প্ল্যাটফর্ম সেটিংস' : 'Settings'}
            </button>
            <button 
              onClick={() => window.location.hash = '#/admin/analytics'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/admin/analytics' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'বিশ্লেষণ' : 'Analytics'}
            </button>
            <button 
              onClick={() => window.location.hash = '#/admin/complaints'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap ${
                currentHash === '#/admin/complaints' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              {lang === 'BN' ? 'অভিযোগসমূহ' : 'Complaints'}
            </button>
            <button 
              onClick={() => window.location.hash = '#/admin/ai'}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap flex items-center gap-1.5 ${
                currentHash === '#/admin/ai' 
                  ? 'border-brand-green text-brand-green' 
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> {lang === 'BN' ? 'এআই ইন্টেলিজেন্স' : 'AI Intelligence'}
            </button>
          </div>

          {/* Sub View contents switch */}
          {currentHash === '#/admin/prices' && (
            <div className="animate-slide-up grid lg:grid-cols-3 gap-8">
              {/* Form to update government price */}
              <div className="bg-surface border border-text-secondary/15 rounded-custom p-6 shadow-sm flex flex-col gap-4">
                <h3 className="text-base font-black">{lang === 'BN' ? 'সরকারি ন্যূনতম মূল্য নির্ধারণ' : 'Set Govt MSP'}</h3>
                <form onSubmit={handleCreateGovtPrice} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.variety}</label>
                    <select
                      value={adminPriceForm.variety}
                      onChange={e => setAdminPriceForm(prev => ({ ...prev, variety: e.target.value }))}
                      className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none cursor-pointer"
                    >
                      {['BRRI dhan28', 'BRRI dhan29', 'Miniket', 'Nazirshail', 'BRRI dhan49', 'Chinigura'].map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.season}</label>
                    <input 
                      type="text"
                      required
                      value={adminPriceForm.season}
                      onChange={e => setAdminPriceForm(prev => ({ ...prev, season: e.target.value }))}
                      className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'ন্যূনতম মূল্য (৳/মন)' : 'MSP Price (৳/maund)'}</label>
                    <input 
                      type="number"
                      required
                      placeholder="উদা: ১১৮০"
                      value={adminPriceForm.pricePer40kg}
                      onChange={e => setAdminPriceForm(prev => ({ ...prev, pricePer40kg: e.target.value }))}
                      className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm font-mono text-text-primary focus:border-brand-green outline-none"
                    />
                  </div>
                  <button type="submit" className="w-full bg-brand-green hover:bg-brand-dark text-background font-bold text-sm py-2.5 rounded-custom border-none cursor-pointer shadow-md">
                    {lang === 'BN' ? 'মূল্য সেট করুন' : 'Set Reference Price'}
                  </button>
                </form>
              </div>

              {/* Table of active Govt prices */}
              <div className="lg:col-span-2">
                <h3 className="text-base font-black mb-4">{t.aiPriceFloors}</h3>
                <div className="overflow-x-auto border border-text-secondary/10 rounded-custom bg-surface">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-text-secondary/5 border-b border-text-secondary/10">
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.variety}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.season}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.baseMsp}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right">{t.effectivePrice}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceFloors.map((pf: any) => (
                        <tr key={pf.id} className="border-b border-text-secondary/5 hover:bg-text-secondary/5 transition-all">
                          <td className="p-4 font-bold text-sm">{pf.variety}</td>
                          <td className="p-4 text-sm"><span className="px-2 py-0.5 rounded bg-brand-green/10 text-brand-green text-xs font-bold border border-brand-green/20">{pf.season}</span></td>
                          <td className="p-4 text-sm font-mono">{formatTaka(pf.floorPrice)}</td>
                          <td className="p-4 text-sm text-right font-black font-mono text-brand-green">
                            {formatTaka(pf.adminOverride || pf.floorPrice)}/{t.maund}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {currentHash === '#/admin/cards' && (
            <div className="animate-slide-up flex flex-col gap-8">
              {/* Suspended Mills section */}
              <div>
                <h3 className="text-base font-black text-danger mb-4 flex items-center gap-1.5"><Ban className="w-5 h-5 text-danger" /> {lang === 'BN' ? 'স্থগিত চালকলসমূহ' : 'Suspended Rice Mills'}</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {mills.filter(m => m.isSuspended).map(mill => (
                    <div key={mill.id} className="bg-surface border border-danger/20 rounded-custom p-5 shadow-sm flex flex-col justify-between gap-4">
                      <div>
                        <h4 className="font-black text-base text-text-primary">{mill.millName}</h4>
                        <div className="text-xs text-text-secondary mt-2 flex flex-col gap-1.5">
                          <span>Owner: <strong>{mill.user.name}</strong></span>
                          <span>Phone: <strong>{mill.user.phone}</strong></span>
                          <span>Suspension Reason: <strong className="text-danger italic">&quot;{mill.suspensionReason || 'Red card suspension'}&quot;</strong></span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const r = prompt(lang === 'BN' ? 'স্থগিতাদেশ প্রত্যাহারের কারণ লিখুন:' : 'Enter reason for unsuspending mill:')
                          if (r) handleUnsuspendMill(mill.userId || mill.id, r)
                        }}
                        className="w-full py-2 bg-brand-green text-background hover:bg-brand-dark text-xs font-bold rounded-custom flex items-center justify-center gap-1 border-none cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-background" /> {lang === 'BN' ? 'স্থগিতাদেশ প্রত্যাহার' : 'Lift Suspension'}
                      </button>
                    </div>
                  ))}
                  {mills.filter(m => m.isSuspended).length === 0 && (
                    <div className="bg-surface border border-text-secondary/10 rounded-custom p-6 text-center text-xs text-text-secondary italic col-span-full">
                      {lang === 'BN' ? 'কোনো চালকল বর্তমানে স্থগিত নেই' : 'No mills are currently suspended'}
                    </div>
                  )}
                </div>
              </div>

              {/* Warnings Cards list */}
              <div>
                <h3 className="text-base font-black mb-4 flex items-center gap-1.5"><AlertTriangle className="w-5 h-5 text-warning" /> {lang === 'BN' ? 'সতর্কীকরণ কার্ডের তালিকা' : 'Active Warning Cards'}</h3>
                <div className="overflow-x-auto border border-text-secondary/10 rounded-custom bg-surface">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-text-secondary/5 border-b border-text-secondary/10">
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.millName}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Type</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Reason Details</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Status</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {warningCards.map((c: any) => (
                        <tr key={c.id} className="border-b border-text-secondary/5 hover:bg-text-secondary/5 transition-all text-sm">
                          <td className="p-4 font-bold">{c.mill?.millProfile?.millName || c.mill?.name || 'Registered Mill'}</td>
                          <td className="p-4 uppercase">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              c.cardType === 'yellow' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-danger/10 text-danger border-danger/20'
                            }`}>{c.cardType}</span>
                          </td>
                          <td className="p-4 text-xs text-text-secondary max-w-xs truncate" title={c.description}>{c.description}</td>
                          <td className="p-4">
                            {c.overridden ? (
                              <span className="text-xs text-text-secondary italic flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-text-secondary" /> {lang === 'BN' ? 'বাতিলকৃত' : 'Overridden'}
                              </span>
                            ) : (
                              <span className="text-xs text-brand-green font-bold">{lang === 'BN' ? 'সক্রিয়' : 'Active'}</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {!c.overridden && (
                              <button
                                onClick={() => {
                                  const r = prompt(lang === 'BN' ? 'কার্ডটি বাতিল করার কারণ লিখুন:' : 'Enter reason for overriding card:')
                                  if (r) handleOverrideCard(c.id, r)
                                }}
                                className="bg-transparent border border-warning/30 hover:bg-warning/10 text-warning text-xs font-bold rounded-custom px-2 py-1 cursor-pointer"
                              >
                                {lang === 'BN' ? 'বাতিল করুন' : 'Override'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {warningCards.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-xs text-text-secondary italic">
                            {lang === 'BN' ? 'কোনো সতর্কীকরণ কার্ড নেই' : 'No warning cards have been issued'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {currentHash === '#/admin/disputes' && (
            <div className="animate-slide-up flex flex-col gap-6">
              <h2 className="text-xl font-black flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-danger" /> {t.disputesTitle}</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {adminDisputes.map(dispute => (
                  <div key={dispute.id} className="bg-surface border border-danger/20 rounded-custom p-6 shadow-sm flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex justify-between items-start border-b border-text-secondary/10 pb-3">
                        <span className="font-bold text-sm text-text-primary">Trx ID: #{dispute.transactionId.slice(0, 8)}</span>
                        <span className="px-2 py-0.5 rounded bg-danger/10 text-danger text-xs font-bold border border-danger/20 uppercase">Disputed</span>
                      </div>
                      <div className="text-xs text-text-secondary mt-3 flex flex-col gap-2">
                        <span>Original Price: <strong className="font-mono">{formatTaka(Number(dispute.originalPrice))}/maund</strong></span>
                        <span>Revised Price: <strong className="font-mono text-danger">{formatTaka(Number(dispute.revisedPrice))}/maund</strong></span>
                        <span>Reason: <span className="italic">&quot;{dispute.reason}&quot;</span></span>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setSelectedDispute(dispute); setShowDisputeModal(true); }}
                      className="w-full py-2 bg-brand-green text-background hover:bg-brand-dark text-xs font-bold rounded-custom flex items-center justify-center gap-1 border-none cursor-pointer"
                    >
                      <Gavel className="w-3.5 h-3.5 text-background" /> {t.ruleBtn}
                    </button>
                  </div>
                ))}
                {adminDisputes.length === 0 && (
                  <div className="bg-surface border border-text-secondary/10 rounded-custom p-12 text-center col-span-2">
                    <CheckCircle2 className="w-12 h-12 text-brand-green mx-auto mb-4" />
                    <h3 className="text-lg font-bold mb-1">{lang === 'BN' ? 'কোনো দামের বিরোধ নেই' : 'No active price disputes'}</h3>
                    <p className="text-sm text-text-secondary max-w-sm mx-auto">এই মুহূর্তে কোনো মিলারের বিরুদ্ধে দাম হ্রাসের কোনো অভিযোগ জমা পড়েনি।</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin Settings View */}
          {currentHash === '#/admin/settings' && (
            <div className="animate-slide-up">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Settings className="w-5 h-5 text-brand-green" /> {t.settingsTitle}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {platformSettings.map((setting: any) => (
                  <div key={setting.key} className="bg-surface border border-text-secondary/10 rounded-custom p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">{setting.key.replace(/_/g, ' ')}</span>
                      {setting.key.includes('fee') && <DollarSign className="w-4 h-4 text-brand-green" />}
                      {setting.key.includes('subscription') && <CreditCard className="w-4 h-4 text-warning" />}
                      {setting.key.includes('listing') && <Tag className="w-4 h-4 text-info" />}
                      {setting.key.includes('card') && <AlertTriangle className="w-4 h-4 text-danger" />}
                      {setting.key.includes('expiry') && <Clock className="w-4 h-4 text-text-secondary" />}
                      {setting.key.includes('compliance') && <Shield className="w-4 h-4 text-brand-green" />}
                    </div>
                    <input 
                      type="text"
                      value={setting.value}
                      onChange={(e) => {
                        setPlatformSettings(prev => prev.map(s => s.key === setting.key ? { ...s, value: e.target.value } : s))
                      }}
                      className="bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-lg font-black font-mono text-brand-green"
                    />
                    <p className="text-xs text-text-secondary leading-relaxed">{setting.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-secondary/70">{lang === 'BN' ? 'সর্বশেষ:' : 'Last:'} {setting.updatedBy}</span>
                      <button
                        onClick={async () => {
                          if (!authUser) return
                          try {
                            const res = await fetch('/api/admin', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ type: 'UPDATE_SETTING', adminId: authUser.id, key: setting.key, value: setting.value, description: setting.description })
                            })
                            if (res.ok) {
                              addToast('success', lang === 'BN' ? 'সেটিং আপডেট হয়েছে' : 'Setting updated')
                              fetchPlatformSettings()
                            }
                          } catch { addToast('error', 'Failed to update setting') }
                        }}
                        className="bg-brand-green hover:bg-brand-dark text-background text-xs font-bold px-3 py-1.5 rounded-custom cursor-pointer border-none transition-all"
                      >
                        {t.saveBtn}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Analytics View */}
          {currentHash === '#/admin/analytics' && analyticsData && (
            <div className="animate-slide-up flex flex-col gap-8">
              <h2 className="text-xl font-black flex items-center gap-2"><PieChart className="w-5 h-5 text-brand-green" /> {t.analyticsTitle}</h2>
              
              {/* Revenue Stats Row */}
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-surface border border-text-secondary/10 rounded-custom p-6 text-center">
                  <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{lang === 'BN' ? 'মোট লেনদেন' : 'Total Transactions'}</div>
                  <div className="text-3xl font-black font-mono text-brand-green mt-2">{analyticsData.totalTransactions}</div>
                </div>
                <div className="bg-surface border border-text-secondary/10 rounded-custom p-6 text-center">
                  <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{lang === 'BN' ? 'মোট মূল্যমান' : 'Total Volume'}</div>
                  <div className="text-3xl font-black font-mono text-brand-green mt-2">{formatTaka(Math.round(analyticsData.totalVolume))}</div>
                </div>
                <div className="bg-surface border border-text-secondary/10 rounded-custom p-6 text-center">
                  <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{t.platformRevenue} (0.5%)</div>
                  <div className="text-3xl font-black font-mono text-warning mt-2">{formatTaka(Math.round(analyticsData.platformRevenue))}</div>
                </div>
              </div>

              {/* Transaction Volume Chart */}
              <div className="bg-surface border border-text-secondary/10 rounded-custom p-6">
                <h3 className="text-base font-black mb-4">{t.transactionVolume}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.transactionsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--text-secondary)" opacity={0.1} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--text-secondary)', borderRadius: '6px', fontSize: '12px' }} />
                    <Bar dataKey="count" fill="var(--brand-green)" radius={[4, 4, 0, 0]} name={lang === 'BN' ? 'লেনদেন সংখ্যা' : 'Transaction Count'} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Mill Compliance Comparison */}
              <div className="bg-surface border border-text-secondary/10 rounded-custom p-6">
                <h3 className="text-base font-black mb-4">{t.complianceChart}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.millCompliance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--text-secondary)" opacity={0.1} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
                    <YAxis dataKey="millName" type="category" width={180} tick={{ fontSize: 11 }} stroke="var(--text-secondary)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--text-secondary)', borderRadius: '6px', fontSize: '12px' }} />
                    <Bar dataKey="trustScore" fill="var(--brand-green)" radius={[0, 4, 4, 0]} name={lang === 'BN' ? 'বিশ্বস্ততা স্কোর' : 'Trust Score'} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue Trend */}
              <div className="bg-surface border border-text-secondary/10 rounded-custom p-6">
                <h3 className="text-base font-black mb-4">{t.platformRevenue}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analyticsData.transactionsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--text-secondary)" opacity={0.1} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--text-secondary)', borderRadius: '6px', fontSize: '12px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="var(--brand-green)" strokeWidth={2} dot={{ fill: 'var(--brand-green)', r: 4 }} name={lang === 'BN' ? 'রেভিনিউ (৳)' : 'Revenue (৳)'} />
                    <Line type="monotone" dataKey="volume" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 4 }} name={lang === 'BN' ? 'মোট মূল্যমান (৳)' : 'Volume (৳)'} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* AI Intelligence Sub-View */}
          {currentHash === '#/admin/ai' && (
            <div className="animate-slide-up flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black flex items-center gap-2"><Zap className="w-5 h-5 text-brand-green" /> {lang === 'BN' ? 'এআই ইন্টেলিজেন্স ড্যাশবোর্ড' : 'AI Intelligence Dashboard'}</h2>
                <div className="flex gap-2">
                  <button onClick={fetchAllAiData} disabled={aiLoading} className="bg-brand-green hover:bg-brand-dark text-background text-xs font-bold px-4 py-2 rounded-custom flex items-center gap-1.5 border-none cursor-pointer disabled:opacity-50">
                    <Activity className="w-3.5 h-3.5" /> {aiLoading ? (lang === 'BN' ? 'লোড হচ্ছে...' : 'Loading...') : (lang === 'BN' ? 'রিফ্রেশ' : 'Refresh')}
                  </button>
                  <button onClick={() => setShowNewComplaintModal(true)} className="bg-info hover:bg-info/80 text-background text-xs font-bold px-4 py-2 rounded-custom flex items-center gap-1.5 border-none cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> {lang === 'BN' ? 'নতুন অভিযোগ' : 'New Complaint'}
                  </button>
                </div>
              </div>

              {/* AI Insights Cards */}
              {aiInsights.length > 0 && (
                <div>
                  <h3 className="text-base font-black mb-4 flex items-center gap-1.5"><Eye className="w-4 h-4 text-brand-green" /> {lang === 'BN' ? 'এআই ইনসাইটস' : 'AI Insights'}</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {aiInsights.map((insight: any) => (
                      <div key={insight.id} className={`bg-surface border rounded-custom p-4 flex flex-col gap-2 ${
                        insight.type === 'danger' ? 'border-danger/30' :
                        insight.type === 'warning' ? 'border-warning/30' :
                        insight.type === 'success' ? 'border-success/30' :
                        'border-info/30'
                      }`}>
                        <div className="flex items-center gap-2">
                          {insight.type === 'danger' && <AlertTriangle className="w-4 h-4 text-danger" />}
                          {insight.type === 'warning' && <AlertTriangle className="w-4 h-4 text-warning" />}
                          {insight.type === 'success' && <CheckCircle2 className="w-4 h-4 text-success" />}
                          {insight.type === 'info' && <Info className="w-4 h-4 text-info" />}
                          <span className="text-sm font-black">{insight.title}</span>
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">{insight.description}</p>
                        {insight.metricValue && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-text-secondary">{insight.metric}:</span>
                            <span className={`text-sm font-black font-mono ${
                              insight.type === 'danger' ? 'text-danger' :
                              insight.type === 'warning' ? 'text-warning' :
                              insight.type === 'success' ? 'text-success' :
                              'text-info'
                            }`}>{insight.metricValue}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fraud Detection Overview */}
              {aiFraudData && (
                <div>
                  <h3 className="text-base font-black mb-4 flex items-center gap-1.5"><Shield className="w-4 h-4 text-danger" /> {lang === 'BN' ? 'ফ্রড ডিটেকশন' : 'Fraud Detection'}</h3>
                  <div className="grid md:grid-cols-4 gap-4 mb-4">
                    <div className={`bg-surface border rounded-custom p-5 text-center ${
                      aiFraudData.overall?.riskLevel === 'critical' ? 'border-danger/30' :
                      aiFraudData.overall?.riskLevel === 'high' ? 'border-warning/30' :
                      aiFraudData.overall?.riskLevel === 'medium' ? 'border-info/30' :
                      'border-success/30'
                    }`}>
                      <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{lang === 'BN' ? 'সামগ্রিক ঝুঁকি' : 'Overall Risk'}</div>
                      <div className={`text-3xl font-black font-mono mt-2 ${
                        aiFraudData.overall?.riskLevel === 'critical' ? 'text-danger' :
                        aiFraudData.overall?.riskLevel === 'high' ? 'text-warning' :
                        aiFraudData.overall?.riskLevel === 'medium' ? 'text-info' :
                        'text-success'
                      }`}>{aiFraudData.overall?.riskScore || 0}</div>
                      <div className={`text-xs font-bold mt-1 uppercase ${
                        aiFraudData.overall?.riskLevel === 'critical' ? 'text-danger' :
                        aiFraudData.overall?.riskLevel === 'high' ? 'text-warning' :
                        aiFraudData.overall?.riskLevel === 'medium' ? 'text-info' :
                        'text-success'
                      }`}>{aiFraudData.overall?.riskLevel || 'low'}</div>
                    </div>
                    <div className="bg-surface border border-text-secondary/10 rounded-custom p-5 text-center">
                      <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{lang === 'BN' ? 'মূল্য হেরফের' : 'Price Manipulation'}</div>
                      <div className="text-3xl font-black font-mono mt-2 text-brand-green">{aiFraudData.priceManipulation?.riskScore || 0}</div>
                      <div className="text-xs text-text-secondary font-bold mt-1">{aiFraudData.priceManipulation?.flags?.length || 0} flags</div>
                    </div>
                    <div className="bg-surface border border-text-secondary/10 rounded-custom p-5 text-center">
                      <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{lang === 'BN' ? 'মিল অস্বাভাবিকতা' : 'Mill Anomalies'}</div>
                      <div className="text-3xl font-black font-mono mt-2 text-brand-green">{aiFraudData.millAnomalies?.filter((m: any) => m.result.riskScore >= 40).length || 0}</div>
                      <div className="text-xs text-text-secondary font-bold mt-1">{lang === 'BN' ? 'উচ্চ ঝুঁকি' : 'High Risk'}</div>
                    </div>
                    <div className="bg-surface border border-text-secondary/10 rounded-custom p-5 text-center">
                      <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{lang === 'BN' ? 'অভিযোগ ফ্রড' : 'Complaint Fraud'}</div>
                      <div className="text-3xl font-black font-mono mt-2 text-brand-green">{aiFraudData.complaintFraud?.riskScore || 0}</div>
                      <div className="text-xs text-text-secondary font-bold mt-1">{aiFraudData.complaintFraud?.flags?.length || 0} flags</div>
                    </div>
                  </div>

                  {/* Fraud Alerts */}
                  {aiFraudData.alerts?.length > 0 && (
                    <div className="bg-surface border border-danger/20 rounded-custom p-4">
                      <h4 className="text-sm font-black text-danger mb-3 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {lang === 'BN' ? 'সক্রিয় ফ্রড সতর্কতা' : 'Active Fraud Alerts'}</h4>
                      <div className="flex flex-col gap-2">
                        {aiFraudData.alerts.map((alert: any) => (
                          <div key={alert.id} className="flex items-center gap-3 p-3 bg-background border border-danger/10 rounded-custom">
                            <div className={`w-2 h-2 rounded-full ${
                              alert.riskLevel === 'critical' ? 'bg-danger' :
                              alert.riskLevel === 'high' ? 'bg-warning' : 'bg-info'
                            }`} />
                            <div className="flex-1">
                              <span className="text-xs font-bold">{alert.targetName}</span>
                              <span className="text-xs text-text-secondary ml-2">({alert.riskScore}/100)</span>
                            </div>
                            <span className="text-xs text-text-secondary max-w-xs truncate">{alert.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Complaint Triage */}
              <div>
                <h3 className="text-base font-black mb-4 flex items-center gap-1.5"><FileText className="w-4 h-4 text-brand-green" /> {lang === 'BN' ? 'অভিযোগ ট্রায়াজ' : 'Complaint Triage'}</h3>
                {aiComplaints.length > 0 ? (
                  <div className="overflow-x-auto border border-text-secondary/10 rounded-custom bg-surface">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-text-secondary/5 border-b border-text-secondary/10">
                          <th className="p-3 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'শিরোনাম' : 'Title'}</th>
                          <th className="p-3 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'বিভাগ' : 'Category'}</th>
                          <th className="p-3 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'অগ্রাধিকার' : 'Priority'}</th>
                          <th className="p-3 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'ফ্রড স্কোর' : 'Fraud Score'}</th>
                          <th className="p-3 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'অবস্থা' : 'Status'}</th>
                          <th className="p-3 text-xs font-bold text-text-secondary uppercase tracking-wider text-right">{lang === 'BN' ? 'অ্যাকশন' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiComplaints.map((c: any) => (
                          <tr key={c.id} className="border-b border-text-secondary/5 hover:bg-text-secondary/5 transition-all">
                            <td className="p-3">
                              <div className="font-bold text-sm">{c.title}</div>
                              {c.aiSummary && <div className="text-xs text-text-secondary mt-1 max-w-xs truncate">{c.aiSummary}</div>}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                c.aiCategory === 'fraud' ? 'bg-danger/10 text-danger border-danger/20' :
                                c.aiCategory === 'overpricing' ? 'bg-warning/10 text-warning border-warning/20' :
                                c.aiCategory === 'delivery_issue' ? 'bg-info/10 text-info border-info/20' :
                                c.aiCategory === 'product_quality' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                                'bg-text-secondary/10 text-text-secondary border-text-secondary/20'
                              }`}>{c.aiCategory || c.category}</span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                c.aiPriority === 'high' ? 'text-danger' :
                                c.aiPriority === 'medium' ? 'text-warning' :
                                'text-success'
                              }`}>{c.aiPriority || c.priority}</span>
                            </td>
                            <td className="p-3">
                              <span className={`text-sm font-mono font-bold ${
                                (c.aiFraudScore || 0) >= 70 ? 'text-danger' :
                                (c.aiFraudScore || 0) >= 40 ? 'text-warning' :
                                'text-success'
                              }`}>{c.aiFraudScore || 0}</span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                                c.status === 'resolved' ? 'bg-success/10 text-success border-success/20' :
                                c.status === 'dismissed' ? 'bg-text-secondary/10 text-text-secondary border-text-secondary/20' :
                                c.status === 'under_review' ? 'bg-info/10 text-info border-info/20' :
                                'bg-warning/10 text-warning border-warning/20'
                              }`}>{c.status}</span>
                            </td>
                            <td className="p-3 text-right">
                              {c.status === 'pending' && (
                                <button
                                  onClick={() => handleUpdateComplaintStatus(c.id, 'under_review')}
                                  className="bg-info/10 hover:bg-info/20 text-info text-xs font-bold px-2 py-1 rounded border border-info/20 cursor-pointer"
                                >
                                  {lang === 'BN' ? 'পর্যালোচনা' : 'Review'}
                                </button>
                              )}
                              {c.status === 'under_review' && (
                                <button
                                  onClick={() => handleUpdateComplaintStatus(c.id, 'resolved')}
                                  className="bg-success/10 hover:bg-success/20 text-success text-xs font-bold px-2 py-1 rounded border border-success/20 cursor-pointer"
                                >
                                  {lang === 'BN' ? 'সমাধান' : 'Resolve'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-surface border border-text-secondary/10 rounded-custom p-6 text-center text-xs text-text-secondary italic">
                    {lang === 'BN' ? 'কোনো অভিযোগ নেই' : 'No complaints filed yet'}
                  </div>
                )}
              </div>

              {/* Demand Forecast */}
              {aiForecastData && (
                <div>
                  <h3 className="text-base font-black mb-4 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-brand-green" /> {lang === 'BN' ? 'ডিমান্ড ফোরকাস্ট' : 'Demand Forecast'}</h3>
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-surface border border-text-secondary/10 rounded-custom p-5">
                      <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{lang === 'BN' ? 'প্রবণতা' : 'Trend'}</div>
                      <div className={`text-2xl font-black mt-2 ${
                        aiForecastData.trend === 'increasing' ? 'text-success' :
                        aiForecastData.trend === 'decreasing' ? 'text-danger' :
                        'text-info'
                      }`}>{aiForecastData.trend?.toUpperCase()}</div>
                      <div className="text-xs text-text-secondary mt-1">{aiForecastData.trendPercent || 0}% change</div>
                    </div>
                    <div className="bg-surface border border-text-secondary/10 rounded-custom p-5">
                      <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{lang === 'BN' ? 'আত্মবিশ্বাস' : 'Confidence'}</div>
                      <div className="text-2xl font-black font-mono text-brand-green mt-2">{aiForecastData.confidence || 0}%</div>
                      <div className="text-xs text-text-secondary mt-1">{aiForecastData.variety} / {aiForecastData.district}</div>
                    </div>
                    <div className="bg-surface border border-text-secondary/10 rounded-custom p-5">
                      <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">{lang === 'BN' ? 'পয়েন্ট' : 'Data Points'}</div>
                      <div className="text-2xl font-black font-mono text-brand-green mt-2">{aiForecastData.forecasts?.length || 0}</div>
                      <div className="text-xs text-text-secondary mt-1">{lang === 'BN' ? 'ঐতিহাসিক + পূর্বাভাস' : 'Historical + Forecast'}</div>
                    </div>
                  </div>

                  {/* Forecast Chart */}
                  {aiForecastData.forecasts?.length > 0 && (
                    <div className="bg-surface border border-text-secondary/10 rounded-custom p-6">
                      <h4 className="text-sm font-black mb-4">{lang === 'BN' ? 'ডিমান্ড পূর্বাভাস চার্ট' : 'Demand Forecast Chart'}</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={aiForecastData.forecasts}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--text-secondary)" opacity={0.1} />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-secondary)" />
                          <YAxis tick={{ fontSize: 11 }} stroke="var(--text-secondary)" />
                          <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--text-secondary)', borderRadius: '6px', fontSize: '12px' }} />
                          <Legend />
                          <Line type="monotone" dataKey="predicted" stroke="var(--brand-green)" strokeWidth={2} dot={{ fill: 'var(--brand-green)', r: 3 }} name={lang === 'BN' ? 'পূর্বাভাস' : 'Forecast'} />
                          <Line type="monotone" dataKey="upperBound" stroke="#3B82F6" strokeWidth={1} strokeDasharray="5 5" dot={false} name={lang === 'BN' ? 'উচ্চ সীমা' : 'Upper Bound'} />
                          <Line type="monotone" dataKey="lowerBound" stroke="#F59E0B" strokeWidth={1} strokeDasharray="5 5" dot={false} name={lang === 'BN' ? 'নিম্ন সীমা' : 'Lower Bound'} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="bg-brand-green/5 border border-brand-green/20 rounded-custom p-4 mt-4">
                    <p className="text-xs text-brand-green font-semibold">{aiForecastData.recommendation}</p>
                  </div>
                </div>
              )}

              {/* Forecast Summaries */}
              {aiForecastSummaries.length > 0 && (
                <div>
                  <h3 className="text-base font-black mb-4 flex items-center gap-1.5"><Package className="w-4 h-4 text-brand-green" /> {lang === 'BN' ? 'ফসল ভিত্তিক পূর্বাভাস' : 'Crop-wise Forecast'}</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    {aiForecastSummaries.map((s: any) => (
                      <div key={s.cropType} className={`bg-surface border rounded-custom p-4 ${
                        s.shortageRisk ? 'border-danger/30' : 'border-text-secondary/10'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-black">{s.cropType.toUpperCase()}</span>
                          {s.shortageRisk && <span className="px-2 py-0.5 rounded bg-danger/10 text-danger text-xs font-bold border border-danger/20">{lang === 'BN' ? 'সংকট' : 'SHORTAGE'}</span>}
                        </div>
                        <div className="text-xs text-text-secondary space-y-1">
                          <div className="flex justify-between"><span>{lang === 'BN' ? 'বর্তমান' : 'Current'}:</span><span className="font-mono font-bold">{s.currentDemand}</span></div>
                          <div className="flex justify-between"><span>{lang === 'BN' ? 'পূর্বাভাস' : 'Predicted'}:</span><span className="font-mono font-bold">{s.predictedDemand}</span></div>
                          <div className="flex justify-between"><span>{lang === 'BN' ? 'পরিবর্তন' : 'Change'}:</span><span className={`font-mono font-bold ${s.changePercent > 0 ? 'text-success' : 'text-danger'}`}>{s.changePercent > 0 ? '+' : ''}{s.changePercent}%</span></div>
                        </div>
                        <p className="text-xs text-text-secondary mt-2 leading-relaxed">{s.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentHash === '#/admin/complaints' && (
            <div className="animate-slide-up flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-green" /> 
                  {lang === 'BN' ? 'অভিযোগসমূহ (এআই অগ্রাধিকার অনুসারে)' : 'Complaints Manager (AI Priority Sorted)'}
                </h2>
                <button 
                  onClick={fetchAiComplaints} 
                  disabled={aiLoading} 
                  className="bg-brand-green hover:bg-brand-dark text-background text-xs font-bold px-4 py-2 rounded-custom flex items-center gap-1.5 border-none cursor-pointer disabled:opacity-50"
                >
                  <Activity className="w-3.5 h-3.5" /> 
                  {aiLoading ? (lang === 'BN' ? 'লোড হচ্ছে...' : 'Loading...') : (lang === 'BN' ? 'রিফ্রেশ' : 'Refresh')}
                </button>
              </div>

              <div className="bg-surface border border-text-secondary/10 rounded-custom p-6 shadow-sm">
                {aiComplaints.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-text-secondary/5 border-b border-text-secondary/10 text-xs font-bold text-text-secondary uppercase tracking-wider">
                          <th className="p-4">{lang === 'BN' ? 'অভিযোগকারী ও বিবরণ' : 'Reporter & Details'}</th>
                          <th className="p-4">{lang === 'BN' ? 'বিবাদকারী মিল' : 'Target Mill'}</th>
                          <th className="p-4">{lang === 'BN' ? 'এআই অগ্রাধিকার' : 'AI Priority'}</th>
                          <th className="p-4">{lang === 'BN' ? 'ঝুঁকি স্কোর' : 'Fraud Score'}</th>
                          <th className="p-4">{lang === 'BN' ? 'অবস্থা' : 'Status'}</th>
                          <th className="p-4 text-right">{lang === 'BN' ? 'অ্যাকশন' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiComplaints.map((c: any) => (
                          <tr key={c.id} className="border-b border-text-secondary/5 hover:bg-text-secondary/5 transition-all text-sm">
                            <td className="p-4">
                              <div className="font-bold text-text-primary">{c.title}</div>
                              <p className="text-xs text-text-secondary mt-1 max-w-md line-clamp-2">{c.description}</p>
                              <div className="text-[10px] text-text-secondary mt-1.5 flex gap-2 font-bold uppercase">
                                <span>By: {c.filedByUser?.name || 'Farmer'}</span>
                                <span>·</span>
                                <span>{timeAgo(c.createdAt)}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="font-semibold text-text-primary">{c.targetUser?.name || 'N/A'}</div>
                              {c.targetUser?.phone && <div className="text-xs font-mono text-text-secondary mt-0.5">{c.targetUser.phone}</div>}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                c.aiPriority?.toLowerCase() === 'high' ? 'bg-danger/10 text-danger border-danger/20' :
                                c.aiPriority?.toLowerCase() === 'medium' ? 'bg-warning/10 text-warning border-warning/20' :
                                'bg-success/10 text-success border-success/20'
                              } uppercase`}>
                                {c.aiPriority || c.priority}
                              </span>
                            </td>
                            <td className="p-4 font-mono font-bold">
                              <span className={
                                (c.aiFraudScore || 0) >= 70 ? 'text-danger' :
                                (c.aiFraudScore || 0) >= 40 ? 'text-warning' :
                                'text-success'
                              }>
                                {c.aiFraudScore || 0}%
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                c.status === 'resolved' ? 'bg-success/10 text-success border-success/20' :
                                c.status === 'dismissed' ? 'bg-text-secondary/10 text-text-secondary border-text-secondary/20' :
                                c.status === 'under_review' ? 'bg-info/10 text-info border-info/20' :
                                'bg-warning/10 text-warning border-warning/20'
                              } uppercase`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => {
                                  setViewingComplaint(c)
                                  setAdminNotesText(c.adminNotes || '')
                                  setShowComplaintDetailsModal(true)
                                }}
                                className="bg-brand-green/15 hover:bg-brand-green/25 text-brand-green text-xs font-bold px-3 py-1.5 rounded-custom transition-all cursor-pointer border-none"
                              >
                                {lang === 'BN' ? 'বিস্তারিত দেখুন' : 'View Details'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-text-secondary italic">
                    {lang === 'BN' ? 'কোনো অভিযোগ পাওয়া যায়নি' : 'No complaints found'}
                  </div>
                )}
              </div>
            </div>
          )}

          {(currentHash === '#/admin' || !['#/admin/prices', '#/admin/cards', '#/admin/disputes', '#/admin/settings', '#/admin/analytics', '#/admin/ai', '#/admin/complaints'].includes(currentHash)) && (
            <div className="animate-slide-up">
              {/* Admin stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                {[
                  { icon: <Users className="w-5 h-5 text-brand-green" />, value: adminStats.totalUsers, label: t.totalUsers, color: 'text-brand-green bg-brand-green/10' },
                  { icon: <Sprout className="w-5 h-5 text-success" />, value: adminStats.totalFarmers, label: t.farmers, color: 'text-success bg-success/10' },
                  { icon: <Building2 className="w-5 h-5 text-warning" />, value: adminStats.totalMills, label: t.mills, color: 'text-warning bg-warning/10' },
                  { icon: <Package className="w-5 h-5 text-info" />, value: adminStats.activeListings, label: t.availableListings, color: 'text-info bg-info/10' },
                ].map((s, i) => (
                  <div key={i} className="bg-surface border border-text-secondary/10 rounded-custom p-6 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-custom flex items-center justify-center ${s.color}`}>{s.icon}</div>
                    <div>
                      <div className="text-2xl font-black font-mono">{s.value}</div>
                      <div className="text-xs text-text-secondary font-bold uppercase tracking-wider mt-0.5">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mill management table */}
              <div className="mb-12">
                <h2 className="text-xl font-black mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-brand-green" /> {t.millManagement}</h2>
                <div className="overflow-x-auto border border-text-secondary/10 rounded-custom bg-surface">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-text-secondary/5 border-b border-text-secondary/10">
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.millName}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.owner}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.district}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.millCompliance}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.dealsCount}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.cards}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.status}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mills.map((mill: any) => (
                        <tr key={mill.id} className="border-b border-text-secondary/5 hover:bg-text-secondary/5 transition-all">
                          <td className="p-4 font-bold text-sm">{mill.millName}</td>
                          <td className="p-4 text-sm">{mill.user.name}</td>
                          <td className="p-4 text-sm">{mill.district || 'Dinajpur'}</td>
                          <td className="p-4 text-sm text-brand-green font-bold flex items-center gap-0.5"><Star className="w-3.5 h-3.5 fill-brand-green text-brand-green" /> {mill.user.trustScore}%</td>
                          <td className="p-4 text-sm font-semibold">{mill.capacityTon ? mill.capacityTon * 10 : 12}</td>
                          <td className="p-4 text-sm">
                            {warningCards.filter(c => c.millId === (mill.userId || mill.id) && !c.overridden && c.cardType === 'green').length > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-success/10 text-success text-xs font-bold border border-success/20 mr-1.5">
                                <Award className="w-3 h-3" /> {warningCards.filter(c => c.millId === (mill.userId || mill.id) && !c.overridden && c.cardType === 'green').length}
                              </span>
                            )}
                            {warningCards.filter(c => c.millId === (mill.userId || mill.id) && !c.overridden && c.cardType === 'yellow').length > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-warning/10 text-warning text-xs font-bold border border-warning/20 mr-1.5">
                                <AlertTriangle className="w-3 h-3" /> {warningCards.filter(c => c.millId === (mill.userId || mill.id) && !c.overridden && c.cardType === 'yellow').length}
                              </span>
                            )}
                            {warningCards.filter(c => c.millId === (mill.userId || mill.id) && !c.overridden && c.cardType === 'red').length > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-danger/10 text-danger text-xs font-bold border border-danger/20">
                                <Ban className="w-3 h-3" /> {warningCards.filter(c => c.millId === (mill.userId || mill.id) && !c.overridden && c.cardType === 'red').length}
                              </span>
                            )}
                            {warningCards.filter(c => c.millId === (mill.userId || mill.id) && !c.overridden).length === 0 && (
                              <span className="text-xs text-text-secondary font-semibold">{t.clean}</span>
                            )}
                          </td>
                          <td className="p-4 text-sm">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              mill.isSuspended 
                                ? 'bg-danger/10 text-danger border-danger/20' 
                                : 'bg-brand-green/10 text-brand-green border-brand-green/20'
                            }`}>{mill.isSuspended ? t.suspended : t.active}</span>
                          </td>
                          <td className="p-4 text-sm text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                className="bg-transparent border border-success/30 hover:bg-success/10 text-success text-xs font-bold rounded-custom px-2.5 py-1.5 flex items-center gap-1 cursor-pointer"
                                onClick={async () => {
                                  const reason = prompt(lang === 'BN' ? 'গ্রিন কার্ডের কারণ লিখুন:' : 'Enter reason for green card:')
                                  if (reason) {
                                    try {
                                      const res = await fetch('/api/admin', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          type: 'GREEN_CARD',
                                          adminId: authUser.id,
                                          targetUserId: mill.userId || mill.id,
                                          reason,
                                        }),
                                      })
                                      if (res.ok) {
                                        addToast('success', lang === 'BN'
                                          ? `${mill.millName}-কে গ্রিন কার্ড দেওয়া হয়েছে (বিশ্বস্ততা +5)`
                                          : `Green card issued to ${mill.millName} (Trust +5)`)
                                        fetchAdminData()
                                      }
                                    } catch {
                                      addToast('error', lang === 'BN' ? 'গ্রিন কার্ড দিতে ব্যর্থ হয়েছে' : 'Failed to issue green card')
                                    }
                                  }
                                }}
                              >
                                <Award className="w-3.5 h-3.5" /> {lang === 'BN' ? 'গ্রিন কার্ড' : 'Green Card'}
                              </button>
                              <button 
                                className="bg-transparent border border-warning/30 hover:bg-warning/10 text-warning text-xs font-bold rounded-custom px-2.5 py-1.5 flex items-center gap-1 cursor-pointer"
                                onClick={() => { setCardTarget({ userId: mill.userId || mill.id, name: mill.millName }); setShowCardModal(true); }}
                              >
                                <AlertTriangle className="w-3.5 h-3.5" /> {t.issueCardBtn}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Audit trail */}
              <div>
                <h2 className="text-xl font-black mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-brand-green" /> {t.auditTrail}</h2>
                <div className="bg-surface border border-text-secondary/10 rounded-custom p-6 flex flex-col gap-3">
                  {auditLogs.slice(0, 10).map((log: any) => (
                    <div key={log.id} className="flex items-center gap-3 p-3 bg-background border border-text-secondary/5 rounded-custom text-xs">
                      {log.action.includes('CREATED') && <Package className="w-4 h-4 text-brand-green" />}
                      {log.action.includes('PLACED') && <Gavel className="w-4 h-4 text-warning" />}
                      {log.action.includes('ACCEPTED') && <CheckCircle2 className="w-4 h-4 text-success" />}
                      {log.action.includes('REJECTED') && <XCircle className="w-4 h-4 text-danger" />}
                      {log.action.includes('CARD') && <AlertTriangle className="w-4 h-4 text-warning" />}
                      
                      <span className="font-bold text-text-primary">{log.user?.name || 'System'}</span>
                      <span className="text-text-secondary">{log.action.replace(/_/g, ' ').toLowerCase()}</span>
                      <span className="font-mono text-text-secondary/70">#{log.entityId.slice(0, 8)}</span>
                      <span className="ml-auto text-text-secondary/70 font-semibold">{timeAgo(log.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ PRICING PAGE ═══ */}
      {role === 'PRICING' && (
        <div className="max-w-5xl mx-auto px-6 py-16 animate-fade-in">
          {/* Hero */}
          <div className="text-center mb-16">
            <div className="w-16 h-16 rounded-custom bg-brand-green/10 text-brand-green flex items-center justify-center mx-auto mb-6">
              <CreditCard className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-black mb-3">{t.pricingTitle}</h1>
            <p className="text-text-secondary text-base max-w-xl mx-auto">{t.pricingTagline}</p>
          </div>

          {/* Tier Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {/* Free Mill Tier */}
            <div className="bg-surface border border-text-secondary/15 rounded-custom p-8 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-text-secondary" />
                <h3 className="text-lg font-black">{t.pricingFreeTitle}</h3>
              </div>
              <div className="text-3xl font-black font-mono text-text-secondary">৳0<span className="text-sm font-medium text-text-secondary/70 ml-1">{lang === 'BN' ? '/মাস' : '/month'}</span></div>
              <p className="text-sm text-text-secondary leading-relaxed">{t.pricingFreeDesc}</p>
              <div className="flex flex-col gap-2 mt-2">
                {[
                  lang === 'BN' ? 'লিস্টিং ব্রাউজ করুন' : 'Browse active listings',
                  lang === 'BN' ? 'বাজার দর দেখুন' : 'View live market prices',
                  lang === 'BN' ? 'মিল ইনভেন্টরি বোর্ড' : 'Mill inventory board',
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-text-secondary">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-green" />
                    {f}
                  </div>
                ))}
                {[
                  lang === 'BN' ? 'যোগাযোগ করতে পারবেন না' : 'Cannot send contact requests',
                  lang === 'BN' ? 'পুশ নোটিফিকেশন নেই' : 'No push notifications',
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-text-secondary/50">
                    <XCircle className="w-3.5 h-3.5 text-danger/50" />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Paid Mill Tier */}
            <div className="bg-surface border-2 border-brand-green rounded-custom p-8 flex flex-col gap-4 relative shadow-lg">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 bg-brand-green text-background text-xs font-black rounded-full">
                {lang === 'BN' ? 'প্রস্তাবিত' : 'Recommended'}
              </div>
              <div className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-brand-green" />
                <h3 className="text-lg font-black">{t.pricingPaidTitle}</h3>
              </div>
              <div className="text-3xl font-black font-mono text-brand-green">৳{platformSettings.find(s => s.key === 'mill_subscription_monthly')?.value || '500'}<span className="text-sm font-medium text-text-secondary/70 ml-1">{lang === 'BN' ? '/মাস' : '/month'}</span></div>
              <p className="text-sm text-text-secondary leading-relaxed">{t.pricingPaidDesc}</p>
              <div className="flex flex-col gap-2 mt-2">
                {[
                  lang === 'BN' ? 'আনলিমিটেড যোগাযোগ' : 'Unlimited contact requests',
                  lang === 'BN' ? 'পুশ নোটিফিকেশন' : 'Push notifications for matching crops',
                  lang === 'BN' ? 'লিস্টিং ব্রাউজ করুন' : 'Browse all listings',
                  lang === 'BN' ? 'এসএমএস আপডেট' : 'SMS updates for bids',
                  lang === 'BN' ? 'নেগোশিয়েশন চ্যাট' : 'Negotiation chat with farmers',
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-text-primary">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-green" />
                    {f}
                  </div>
                ))}
              </div>
              {(!authUser || authUser.role === 'MILL') && (
                <button className="mt-4 w-full bg-brand-green hover:bg-brand-dark text-background font-black text-sm py-3 rounded-custom cursor-pointer border-none transition-all" onClick={() => window.location.hash = '#/mill'}>
                  {lang === 'BN' ? 'মিল হিসেবে যোগ দিন' : 'Get Started as Mill'}
                </button>
              )}
            </div>

            {/* Farmer Tier */}
            <div className="bg-surface border border-text-secondary/15 rounded-custom p-8 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Sprout className="w-5 h-5 text-brand-green" />
                <h3 className="text-lg font-black">{t.pricingFarmerTitle}</h3>
              </div>
              <div className="text-3xl font-black font-mono text-brand-green">৳0<span className="text-sm font-medium text-text-secondary/70 ml-1">{lang === 'BN' ? '/সবসময়' : '/forever'}</span></div>
              <p className="text-sm text-text-secondary leading-relaxed">{t.pricingFarmerDesc}</p>
              <div className="flex flex-col gap-2 mt-2">
                {[
                  lang === 'BN' ? 'ধান তালিকাভুক্ত করুন' : 'Post crop listings',
                  lang === 'BN' ? 'এআই ন্যায্য মূল্য' : 'AI fair price floor',
                  lang === 'BN' ? 'মিলের দর পান' : 'Receive mill offers',
                  lang === 'BN' ? 'নেগোশিয়েশন চ্যাট' : 'Negotiation chat',
                  lang === 'BN' ? 'এসএমএস আপডেট' : 'SMS notifications',
                  lang === 'BN' ? 'পেমেন্ট ট্র্যাকিং' : 'Payment tracking',
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-text-primary">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-green" />
                    {f}
                  </div>
                ))}
              </div>
              {(!authUser || authUser.role === 'FARMER') && (
                <button className="mt-4 w-full bg-brand-green hover:bg-brand-dark text-background font-black text-sm py-3 rounded-custom cursor-pointer border-none transition-all" onClick={() => window.location.hash = '#/farmer'}>
                  {lang === 'BN' ? 'কৃষক হিসেবে যোগ দিন' : 'Get Started as Farmer'}
                </button>
              )}
            </div>
          </div>

          {/* Transaction Fee Section */}
          <div className="bg-surface border border-text-secondary/10 rounded-custom p-8 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-custom bg-warning/10 text-warning flex items-center justify-center"><DollarSign className="w-5 h-5" /></div>
              <div>
                <h3 className="text-lg font-black">{t.txFeeTitle}</h3>
                <p className="text-sm text-text-secondary">{t.txFeeDesc}</p>
              </div>
            </div>
            <div className="bg-background border border-text-secondary/10 rounded-custom p-4 text-xs text-text-secondary font-mono leading-relaxed">
              {lang === 'BN' 
                ? 'উদাহরণ: ৳১,০০,০০০ লেনদেনে প্ল্যাটফর্ম ফি = ৳৫০০ (০.৫%)। bKash/Nagad ওয়েবহুকের মাধ্যমে মিলের পেমেন্ট থেকে স্বয়ংক্রিয়ভাবে কেটে নেওয়া হয়।' 
                : 'Example: On a ৳1,00,000 transaction, platform fee = ৳500 (0.5%). Automatically deducted from mill payment via bKash/Nagad webhook.'}
            </div>
          </div>

          {/* Featured Listing Teaser */}
          <div className="bg-surface border border-text-secondary/10 rounded-custom p-8 mb-8 opacity-70">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-custom bg-info/10 text-info flex items-center justify-center"><Tag className="w-5 h-5" /></div>
              <div>
                <h3 className="text-lg font-black">{t.featuredTitle}</h3>
                <p className="text-sm text-text-secondary">{t.featuredDesc}</p>
              </div>
            </div>
          </div>

          {/* No Farmer Fees Banner */}
          <div className="bg-brand-green/10 border border-brand-green/20 rounded-custom p-8 text-center">
            <Leaf className="w-10 h-10 text-brand-green mx-auto mb-3" />
            <h2 className="text-2xl font-black text-brand-green mb-2">{t.noFarmerFees}</h2>
            <p className="text-sm text-text-secondary max-w-lg mx-auto">
              {lang === 'BN' 
                ? 'কৃষিদাম বিশ্বাস করে প্রতিটি কৃষকের ন্যায্য মূল্য পাওয়ার অধিকার আছে — কোনো গোপন চার্জ ছাড়াই। প্ল্যাটফর্মের সমস্ত খরচ মিলারদের সদস্যতা ও লেনদেন ফি থেকে পরিচালিত হয়।'
                : 'KrishiDam believes every farmer deserves fair prices — with zero hidden charges. All platform costs are sustained through mill subscriptions and transaction fees.'}
            </p>
          </div>
        </div>
      )}

      {/* ═══ MARKET BOARD ═══ */}
      {role === 'MARKET' && (
        <div className="max-w-7xl mx-auto px-6 py-8 animate-fade-in">
          <div className="mb-10 text-center md:text-left">
            <h1 className="text-3xl font-black flex flex-col md:flex-row items-center gap-2 justify-center md:justify-start">
              <TrendingUp className="w-8 h-8 text-brand-green" /> {t.marketTitle}
            </h1>
            <p className="text-text-secondary mt-1 text-sm">{t.marketTagline}</p>
          </div>

          {/* Sub Navigation Tab Selector */}
          <div className="flex border-b border-text-secondary/15 pb-4 mb-8 overflow-x-auto gap-4">
            <button
              onClick={() => setMarketTab('prices')}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap flex items-center gap-2 ${
                marketTab === 'prices'
                  ? 'border-brand-green text-brand-green font-black'
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              {lang === 'BN' ? 'বাজার দর ও লিস্টিং' : 'Market Prices & Listings'}
            </button>
            <button
              onClick={() => setMarketTab('inventories')}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap flex items-center gap-2 ${
                marketTab === 'inventories'
                  ? 'border-brand-green text-brand-green font-black'
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              <Factory className="w-4 h-4" />
              {t.millInventoryTitle}
            </button>
            <button
              onClick={() => setMarketTab('transactions')}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap flex items-center gap-2 ${
                marketTab === 'transactions'
                  ? 'border-brand-green text-brand-green font-black'
                  : 'border-transparent text-text-secondary hover:text-brand-green'
              }`}
            >
              <FileText className="w-4 h-4" />
              {t.recentTransactions}
            </button>
          </div>

          {/* Tab 1: Prices & Trends */}
          {marketTab === 'prices' && (
            <div className="animate-slide-up flex flex-col gap-8">
              {/* Price trends */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                {marketPrices.map((mp, i) => {
                  const hasPrice = mp.currentPrice > 0;
                  return (
                    <div key={i} className="bg-surface border border-text-secondary/10 rounded-custom p-6 shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-bold text-text-primary">{mp.variety}</span>
                        {hasPrice && (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-0.5 ${
                            mp.change >= 0 
                              ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' 
                              : 'bg-danger/10 text-danger border border-danger/20'
                          }`}>
                            {mp.change >= 0 ? '+' : ''}{mp.changePercent.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="text-3xl font-black font-mono text-brand-green">
                        {hasPrice ? formatTaka(mp.currentPrice) : (lang === 'BN' ? 'তথ্য নেই' : 'No Data')}
                        {hasPrice && <span className="text-xs text-text-secondary font-sans font-medium ml-1.5">/{t.maund}</span>}
                      </div>
                      <div className="w-full bg-background h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div 
                          className={`h-full rounded-full ${!hasPrice ? 'bg-text-secondary/20' : mp.change >= 0 ? 'bg-brand-green' : 'bg-danger'}`} 
                          style={{ width: hasPrice ? `${Math.min(100, 50 + Math.abs(mp.changePercent) * 6)}%` : '0%' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active listings table */}
              <div>
                <h2 className="text-xl font-black mb-4 flex items-center gap-2">
                  <Wheat className="w-5 h-5 text-brand-green" />
                  {t.availableListings}
                </h2>
                <div className="overflow-x-auto border border-text-secondary/10 rounded-custom bg-surface">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-text-secondary/5 border-b border-text-secondary/10">
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.variety}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.season}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.quantityLabel}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.grade}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.district}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.aiFloorPrice}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.bidsCount}</th>
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right">{t.expiresInLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listings.filter(l => l.status?.toLowerCase() === 'active').map(listing => (
                        <tr key={listing.id} className="border-b border-text-secondary/5 hover:bg-text-secondary/5 transition-all">
                          <td className="p-4 font-bold text-sm">{listing.variety}</td>
                          <td className="p-4 text-sm"><span className="px-2 py-0.5 rounded bg-brand-green/10 text-brand-green text-xs font-bold border border-brand-green/20">{listing.season}</span></td>
                          <td className="p-4 text-sm font-semibold">{listing.quantity} {t.maund}</td>
                          <td className="p-4 text-sm"><span className="px-2 py-0.5 rounded bg-warning/10 text-warning text-xs font-bold border border-warning/20">{t.grade} {listing.qualityGrade}</span></td>
                          <td className="p-4 text-sm">{listing.district}</td>
                          <td className="p-4 text-sm font-bold font-mono text-brand-green">{formatTaka(listing.aiFloorPrice)}</td>
                          <td className="p-4 text-sm font-semibold">{listing.bids ? listing.bids.length : 0}</td>
                          <td className={`p-4 text-sm text-right font-semibold ${daysLeft(listing.expiresAt) <= 3 ? 'text-warning' : 'text-text-secondary'}`}>
                            {daysLeft(listing.expiresAt)}d
                          </td>
                        </tr>
                      ))}
                      {listings.filter(l => l.status?.toLowerCase() === 'active').length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-text-secondary">
                            {lang === 'BN' ? 'কোনো সক্রিয় ধানের তালিকা পাওয়া যায়নি' : 'No active grain listings found'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Mill Stocks */}
          {marketTab === 'inventories' && (
            <div className="animate-slide-up">
              <h2 className="text-xl font-black mb-4 flex items-center gap-2"><Factory className="w-5 h-5 text-brand-green" /> {t.millInventoryTitle}</h2>
              <div className="overflow-x-auto border border-text-secondary/10 rounded-custom bg-surface">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-text-secondary/5 border-b border-text-secondary/10">
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.millName}</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.variety}</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.grade}</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.quantityLabel}</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.askingPriceLabel}</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right">{t.millCompliance}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {millInventories.map(inv => (
                      <tr key={inv.id} className="border-b border-text-secondary/5 hover:bg-text-secondary/5 transition-all">
                        <td className="p-4 font-bold text-sm">{inv.millName}</td>
                        <td className="p-4 text-sm font-semibold">{inv.riceType}</td>
                        <td className="p-4 text-sm uppercase"><span className="px-2 py-0.5 rounded bg-warning/10 text-warning text-xs font-bold border border-warning/20">{inv.category}</span></td>
                        <td className="p-4 text-sm font-semibold">{inv.quantityMaund} {t.maund}</td>
                        <td className="p-4 text-sm font-black font-mono text-brand-green">{formatTaka(inv.pricePerMaund)}/maund</td>
                        <td className="p-4 text-sm text-right text-brand-green font-bold flex items-center justify-end gap-1"><Star className="w-3.5 h-3.5 fill-brand-green text-brand-green" /> {inv.millTrustScore}%</td>
                      </tr>
                    ))}
                    {millInventories.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-text-secondary">
                          {lang === 'BN' ? 'কোনো চালের স্টক পাওয়া যায়নি' : 'No rice stock inventory found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Completed Transactions */}
          {marketTab === 'transactions' && (
            <div className="animate-slide-up">
              <h2 className="text-xl font-black mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-brand-green" /> {t.recentTransactions}</h2>
              <div className="overflow-x-auto border border-text-secondary/10 rounded-custom bg-surface">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-text-secondary/5 border-b border-text-secondary/10">
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'চালকল' : 'Rice Mill'}</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'কৃষক এলাকা (বেনামী)' : 'Farmer Region (Anonymized)'}</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.variety}</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t.quantityLabel}</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'নির্ধারিত দর' : 'Agreed Price'}</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'মোট মূল্য' : 'Total Value'}</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right">{lang === 'BN' ? 'লেনদেনের সময়' : 'Transaction Date'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map(tx => (
                      <tr key={tx.id} className="border-b border-text-secondary/5 hover:bg-text-secondary/5 transition-all">
                        <td className="p-4 font-bold text-sm">{tx.millName}</td>
                        <td className="p-4 text-sm text-text-secondary">
                          {lang === 'BN' ? `${tx.district} কৃষক` : `${tx.district} Farmer`}
                        </td>
                        <td className="p-4 text-sm font-semibold">{tx.variety}</td>
                        <td className="p-4 text-sm font-semibold">{tx.quantity} {t.maund}</td>
                        <td className="p-4 text-sm font-black font-mono text-brand-green">{formatTaka(tx.agreedPrice)}/{t.maund}</td>
                        <td className="p-4 text-sm font-mono text-text-primary">{formatTaka(tx.totalAmount)}</td>
                        <td className="p-4 text-sm text-right text-text-secondary/70 font-semibold">{timeAgo(tx.createdAt)}</td>
                      </tr>
                    ))}
                    {recentTransactions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-text-secondary">
                          {lang === 'BN' ? 'কোনো সম্পন্ন লেনদেন পাওয়া যায়নি' : 'No completed transactions found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ MODALS & DRAWER ═══ */}

      {/* Auth SMS OTP Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowAuthModal(false)}>
          <div className="bg-surface border border-text-secondary/15 rounded-custom shadow-xl max-w-sm w-full p-6 animate-scale-in flex flex-col gap-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black flex items-center gap-2 text-brand-green"><Phone className="w-5 h-5 text-brand-green" /> {t.loginTitle}</h2>
              <button className="text-text-secondary/80 hover:text-text-primary bg-transparent border-none cursor-pointer" onClick={() => setShowAuthModal(false)}>
                <XCircle className="w-5.5 h-5.5" />
              </button>
            </div>

            {!isFirebaseConfigured && (
              <div className="bg-error/10 border border-error/30 rounded-custom p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                <p className="text-xs text-error font-semibold">
                  {lang === 'BN'
                    ? 'OTP সার্ভিস কনফিগার করা হয়নি। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।'
                    : 'OTP service is not configured. Please contact the administrator.'}
                </p>
              </div>
            )}

            {authForm.step === 'phone' && (
              <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.phoneLabel}</label>
                  <input 
                    type="tel"
                    required
                    placeholder={t.phonePlaceholder}
                    value={authForm.phone}
                    onChange={e => setAuthForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full mt-1.5 bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-sm text-text-primary"
                  />
                </div>
                {authForm.error && <p className="text-xs text-error font-semibold">{authForm.error}</p>}
                <button type="submit" className="w-full bg-brand-green hover:bg-brand-dark text-background font-bold text-sm py-2.5 rounded-custom transition-all cursor-pointer border-none">
                  {t.sendOtp}
                </button>
              </form>
            )}

            {authForm.step === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                <div>
                  <div className="text-xs text-text-secondary leading-relaxed mb-3">{t.otpSentMsg}</div>
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.otpLabel}</label>
                  <input 
                    type="text"
                    required
                    placeholder={t.otpPlaceholder}
                    value={authForm.otp}
                    onChange={e => setAuthForm(prev => ({ ...prev, otp: e.target.value }))}
                    className="w-full mt-1.5 bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-sm text-text-primary font-mono text-center tracking-widest text-lg"
                  />
                </div>
                {authForm.error && <p className="text-xs text-error font-semibold">{authForm.error}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAuthForm(prev => ({ ...prev, step: 'phone', otp: '', error: '' }))} className="flex-1 bg-transparent border border-text-secondary/20 hover:bg-text-secondary/10 text-text-primary text-xs font-bold py-2 rounded-custom cursor-pointer">
                    {t.changePhone}
                  </button>
                  <button type="submit" className="flex-1 bg-brand-green hover:bg-brand-dark text-background text-xs font-bold py-2 rounded-custom transition-all border-none cursor-pointer">
                    {t.verify}
                  </button>
                </div>
              </form>
            )}

            {authForm.step === 'register' && (
              <form onSubmit={handleRegister} className="flex flex-col gap-4 animate-slide-up">
                <div className="text-xs font-bold text-brand-green mb-1">
                  {lang === 'BN' ? 'নতুন ব্যবহারকারী! নিবন্ধন সম্পন্ন করুন:' : 'New user! Complete your registration:'}
                </div>
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'আপনার নাম' : 'Your Name'}</label>
                  <input 
                    type="text"
                    required
                    placeholder={lang === 'BN' ? 'উদা: আব্দুল রশিদ' : 'e.g. Abdul Rashid'}
                    value={authForm.name}
                    onChange={e => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full mt-1.5 bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-sm text-text-primary"
                  />
                </div>

                {authTargetRole === 'MILL' && (
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'মিলের নাম' : 'Rice Mill Name'}</label>
                    <input 
                      type="text"
                      required
                      placeholder={lang === 'BN' ? 'উদা: রশিদ অটো রাইস মিল' : 'e.g. Rashid Auto Rice Mill'}
                      value={authForm.millName}
                      onChange={e => setAuthForm(prev => ({ ...prev, millName: e.target.value }))}
                      className="w-full mt-1.5 bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-sm text-text-primary"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.district}</label>
                    <input 
                      type="text"
                      required
                      placeholder={lang === 'BN' ? 'উদা: দিনাজপুর' : 'e.g. Dinajpur'}
                      value={authForm.district}
                      onChange={e => setAuthForm(prev => ({ ...prev, district: e.target.value }))}
                      className="w-full mt-1.5 bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-sm text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.upazila}</label>
                    <input 
                      type="text"
                      required
                      placeholder={lang === 'BN' ? 'উদা: বিরল' : 'e.g. Birol'}
                      value={authForm.upazila}
                      onChange={e => setAuthForm(prev => ({ ...prev, upazila: e.target.value }))}
                      className="w-full mt-1.5 bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-sm text-text-primary"
                    />
                  </div>
                </div>

                {authForm.error && <p className="text-xs text-error font-semibold">{authForm.error}</p>}
                <button type="submit" className="w-full bg-brand-green hover:bg-brand-dark text-background font-bold text-sm py-2.5 rounded-custom transition-all cursor-pointer border-none mt-2">
                  {lang === 'BN' ? 'নিবন্ধন সম্পন্ন করুন' : 'Complete Signup'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Bid / Contact Request Placement Modal */}
      {showBidModal && selectedListing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowBidModal(false)}>
          <div className="bg-surface border border-text-secondary/15 rounded-custom shadow-xl max-w-md w-full p-6 animate-scale-in flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black">{t.placeBidBtn}</h2>
              <button className="text-text-secondary/80 hover:text-text-primary bg-transparent border-none cursor-pointer" onClick={() => setShowBidModal(false)}>
                <XCircle className="w-5.5 h-5.5" />
              </button>
            </div>

            <div className="bg-background border border-text-secondary/10 p-4 rounded-custom">
              <div className="font-bold text-sm">{selectedListing.variety}</div>
              <div className="text-xs text-text-secondary mt-1">
                {selectedListing.quantity} {t.maund} · {selectedListing.district} · {t.aiFloorPrice}: <strong className="text-brand-green font-mono">{formatTaka(selectedListing.aiFloorPrice)}/{t.maund}</strong>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.askingPriceLabel}</label>
              <input
                className="bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-sm font-mono text-text-primary animate-slide-up"
                type="number"
                placeholder={`Min ${selectedListing.aiFloorPrice}`}
                value={bidFormData.price}
                onChange={e => setBidFormData(prev => ({ ...prev, price: e.target.value }))}
                min={selectedListing.aiFloorPrice}
              />
              {bidFormData.price && parseFloat(bidFormData.price) < selectedListing.aiFloorPrice && (
                <p className="text-danger text-[10px] font-bold mt-1">
                  {lang === 'BN' ? `দরপ্রস্তাব অবশ্যই ন্যূনতম এআই দাম ৳${selectedListing.aiFloorPrice}-এর সমান বা বেশি হতে হবে` : `Bid must be ≥ AI floor price of ${formatTaka(selectedListing.aiFloorPrice)}/maund`}
                </p>
              )}
              {bidFormData.price && parseFloat(bidFormData.price) >= selectedListing.aiFloorPrice && (
                <p className="text-text-secondary text-[10px] font-mono mt-1">
                  {t.totalValue}: {formatTaka(parseFloat(bidFormData.price) * selectedListing.quantity)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.notes}</label>
              <textarea
                className="bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-sm text-text-primary resize-none h-20"
                placeholder={lang === 'BN' ? 'কৃষকের জন্য যেকোনো বার্তা লিখুন...' : 'Add message for the farmer...'}
                value={bidFormData.notes}
                onChange={e => setBidFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <button 
              className="w-full bg-brand-green hover:bg-brand-dark text-background font-bold text-sm py-2.5 rounded-custom transition-all shadow-md cursor-pointer border-none disabled:opacity-50"
              onClick={handlePlaceBid}
              disabled={!bidFormData.price || parseFloat(bidFormData.price) < selectedListing.aiFloorPrice}
            >
              {t.confirmPlaceBid}
            </button>
          </div>
        </div>
      )}

      {/* New Crop Listing Modal */}
      {showNewListingModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowNewListingModal(false)}>
          <div className="bg-surface border border-text-secondary/15 rounded-custom shadow-xl max-w-lg w-full p-6 animate-scale-in flex flex-col gap-4 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black">{t.createListingTitle}</h2>
              <button className="text-text-secondary/80 hover:text-text-primary bg-transparent border-none cursor-pointer" onClick={() => setShowNewListingModal(false)}>
                <XCircle className="w-5.5 h-5.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.variety}</label>
                <select 
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none cursor-pointer"
                  value={listingFormData.variety}
                  onChange={e => setListingFormData(prev => ({ ...prev, variety: e.target.value }))}
                >
                  {['BRRI dhan28', 'BRRI dhan29', 'Miniket', 'Nazirshail', 'BRRI dhan49', 'Chinigura'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.season}</label>
                <select 
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none cursor-pointer"
                  value={listingFormData.season}
                  onChange={e => setListingFormData(prev => ({ ...prev, season: e.target.value }))}
                >
                  {['BORO', 'AMAN', 'AUS'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.quantityLabel}</label>
                <input 
                  type="number"
                  required
                  placeholder="উদা: ১০০"
                  value={listingFormData.quantity}
                  onChange={e => setListingFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm font-mono text-text-primary focus:border-brand-green outline-none animate-slide-up"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.grade}</label>
                <select 
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none cursor-pointer"
                  value={listingFormData.qualityGrade}
                  onChange={e => setListingFormData(prev => ({ ...prev, qualityGrade: e.target.value }))}
                >
                  {['A', 'B', 'C'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.district}</label>
                <input 
                  type="text"
                  value={listingFormData.district}
                  onChange={e => setListingFormData(prev => ({ ...prev, district: e.target.value }))}
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.upazila}</label>
                <input 
                  type="text"
                  placeholder="উদা: বিরল"
                  value={listingFormData.upazila}
                  onChange={e => setListingFormData(prev => ({ ...prev, upazila: e.target.value }))}
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none animate-slide-up"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.askingPriceLabel}</label>
              <input 
                type="number"
                placeholder={t.askingPricePlaceholder}
                value={listingFormData.askingPrice}
                onChange={e => setListingFormData(prev => ({ ...prev, askingPrice: e.target.value }))}
                className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm font-mono text-text-primary focus:border-brand-green outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.descriptionLabel}</label>
              <textarea 
                placeholder={t.cropDescriptionPlaceholder}
                value={listingFormData.description}
                onChange={e => setListingFormData(prev => ({ ...prev, description: e.target.value }))}
                className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none resize-none h-20"
              />
            </div>

            {/* AI Fair Price Engine preview section */}
            {aiPriceResult && (
              <div className="p-4 bg-brand-green/10 border border-brand-green/20 rounded-custom flex flex-col gap-1.5 animate-slide-up">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-brand-green flex items-center gap-1"><Zap className="w-3.5 h-3.5 fill-brand-green" /> {t.aiFairPrice}</span>
                  <span className="px-2 py-0.5 rounded bg-brand-green/20 text-brand-green text-[10px] font-bold uppercase">{t.aiConfidence}: {aiPriceResult.confidence}%</span>
                </div>
                <div className="text-2xl font-black text-brand-green font-mono">{formatTaka(aiPriceResult.floorPrice)}<span className="text-xs font-semibold text-text-secondary ml-1">/{t.maund}</span></div>
                <p className="text-[10px] text-text-secondary font-medium leading-relaxed mt-1">{aiPriceResult.explanation}</p>
              </div>
            )}

            <button 
              className="w-full bg-brand-green hover:bg-brand-dark text-background font-bold text-sm py-2.5 rounded-custom transition-all shadow-md cursor-pointer border-none"
              onClick={handleCreateListing}
            >
              {t.newListingBtn}
            </button>
          </div>
        </div>
      )}

      {/* Warning Card Modal (Admin Action) */}
      {showCardModal && cardTarget && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowCardModal(false)}>
          <div className="bg-surface border border-text-secondary/15 rounded-custom shadow-xl max-w-sm w-full p-6 animate-scale-in flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black">{t.issueCardTitle} ({cardTarget.name})</h2>
              <button className="text-text-secondary/80 hover:text-text-primary bg-transparent border-none cursor-pointer" onClick={() => setShowCardModal(false)}>
                <XCircle className="w-5.5 h-5.5" />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.reasonLabel}</label>
              <textarea 
                placeholder={t.reasonPlaceholder}
                id="card-reason-textarea"
                className="bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-sm text-text-primary resize-none h-24"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <button 
                onClick={() => {
                  const input = document.getElementById('card-reason-textarea') as HTMLTextAreaElement
                  handleIssueCard('GREEN_CARD', input?.value || '')
                }}
                className="py-2.5 bg-success text-background hover:bg-success/95 text-[10px] font-bold rounded-custom cursor-pointer border-none flex flex-col items-center justify-center gap-1 shadow-sm transition-all"
              >
                <Award className="w-4 h-4 text-background" /> {lang === 'BN' ? 'সবুজ কার্ড' : 'Green Card'}
              </button>
              <button 
                onClick={() => {
                  const input = document.getElementById('card-reason-textarea') as HTMLTextAreaElement
                  handleIssueCard('YELLOW_CARD', input?.value || '')
                }}
                className="py-2.5 bg-warning text-background hover:bg-warning/95 text-[10px] font-bold rounded-custom cursor-pointer border-none flex flex-col items-center justify-center gap-1 shadow-sm transition-all"
              >
                <AlertTriangle className="w-4 h-4 text-background" /> {lang === 'BN' ? 'হলুদ কার্ড' : 'Yellow Card'}
              </button>
              <button 
                onClick={() => {
                  const input = document.getElementById('card-reason-textarea') as HTMLTextAreaElement
                  handleIssueCard('RED_CARD', input?.value || '')
                }}
                className="py-2.5 bg-danger text-background hover:bg-danger/95 text-[10px] font-bold rounded-custom cursor-pointer border-none flex flex-col items-center justify-center gap-1 shadow-sm transition-all"
              >
                <Ban className="w-4 h-4 text-background" /> {lang === 'BN' ? 'লাল কার্ড' : 'Red Card'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mill Add Processed Stock Inventory Modal */}
      {showInventoryModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowInventoryModal(false)}>
          <div className="bg-surface border border-text-secondary/15 rounded-custom shadow-xl max-w-sm w-full p-6 animate-scale-in flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black">{t.addInventoryBtn}</h2>
              <button className="text-text-secondary/80 hover:text-text-primary bg-transparent border-none cursor-pointer" onClick={() => setShowInventoryModal(false)}>
                <XCircle className="w-5.5 h-5.5" />
              </button>
            </div>

            <form onSubmit={handleCreateInventory} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.variety}</label>
                <select 
                  required
                  value={inventoryFormData.riceType}
                  onChange={e => setInventoryFormData(prev => ({ ...prev, riceType: e.target.value }))}
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none cursor-pointer"
                >
                  <option value="">Select Rice Variety</option>
                  <option value="BRRI dhan28">BRRI dhan28</option>
                  <option value="BRRI dhan29">BRRI dhan29</option>
                  <option value="Miniket">Miniket</option>
                  <option value="Nazirshail">Nazirshail</option>
                  <option value="BRRI dhan49">BRRI dhan49</option>
                  <option value="Chinigura">Chinigura</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.grade}</label>
                <select 
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none cursor-pointer"
                  value={inventoryFormData.category}
                  onChange={e => setInventoryFormData(prev => ({ ...prev, category: e.target.value }))}
                >
                  <option value="fine">Fine</option>
                  <option value="medium">Medium</option>
                  <option value="coarse">Coarse</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.quantityLabel}</label>
                <input 
                  type="number"
                  required
                  value={inventoryFormData.quantityKg}
                  onChange={e => setInventoryFormData(prev => ({ ...prev, quantityKg: e.target.value }))}
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm font-mono text-text-primary focus:border-brand-green outline-none animate-slide-up"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Price per KG (৳)</label>
                <input 
                  type="number"
                  required
                  value={inventoryFormData.pricePerKg}
                  onChange={e => setInventoryFormData(prev => ({ ...prev, pricePerKg: e.target.value }))}
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm font-mono text-text-primary focus:border-brand-green outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.notes}</label>
                <textarea 
                  value={inventoryFormData.notes}
                  onChange={e => setInventoryFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none resize-none h-16"
                />
              </div>

              <button type="submit" className="w-full bg-brand-green hover:bg-brand-dark text-background font-bold text-sm py-2.5 rounded-custom border-none cursor-pointer shadow-md">
                {t.addInventoryBtn}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Dispute Resolution Ruling Modal */}
      {showDisputeModal && selectedDispute && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowDisputeModal(false)}>
          <div className="bg-surface border border-text-secondary/15 rounded-custom shadow-xl max-w-sm w-full p-6 animate-scale-in flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black">{t.disputesTitle}</h2>
              <button className="text-text-secondary/80 hover:text-text-primary bg-transparent border-none cursor-pointer" onClick={() => setShowDisputeModal(false)}>
                <XCircle className="w-5.5 h-5.5" />
              </button>
            </div>

            <form onSubmit={handleRuleDispute} className="flex flex-col gap-4">
              <div className="text-xs text-text-secondary flex flex-col gap-1">
                <span>Original agreed price: <strong>{formatTaka(Number(selectedDispute.originalPrice))}/maund</strong></span>
                <span>Mill proposed price: <strong>{formatTaka(Number(selectedDispute.revisedPrice))}/maund</strong></span>
                <span>Proposed revised price reason: <span className="italic">&quot;{selectedDispute.reason}&quot;</span></span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.rulingLabel}</label>
                <textarea 
                  required
                  placeholder={t.rulingPlaceholder}
                  value={adminRulingText}
                  onChange={e => setAdminRulingText(e.target.value)}
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none resize-none h-20"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.finalPriceLabel}</label>
                <input 
                  type="number"
                  required
                  placeholder="উদা: ১৩০০"
                  value={adminRulingPrice}
                  onChange={e => setAdminRulingPrice(e.target.value)}
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm font-mono text-text-primary focus:border-brand-green outline-none animate-slide-up"
                />
              </div>

              <button type="submit" className="w-full bg-brand-green hover:bg-brand-dark text-background font-bold text-sm py-2.5 rounded-custom border-none cursor-pointer shadow-md">
                {t.ruleBtn}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Side Chat / Price Negotiation Drawer */}
      {showNegotiationDrawer && selectedBid && (
        <div className="fixed inset-0 z-50 bg-background/40 backdrop-blur-sm flex justify-end" onClick={() => setShowNegotiationDrawer(false)}>
          <div className="bg-surface border-l border-text-secondary/15 w-full max-w-md h-full flex flex-col justify-between p-6 shadow-2xl animate-slide-left" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div>
              <div className="flex justify-between items-center border-b border-text-secondary/10 pb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black flex items-center gap-2 text-brand-green"><MessageSquare className="w-5 h-5 text-brand-green" /> {t.chat}</h2>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-bold border border-success/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    {lang === 'BN' ? 'লাইভ' : 'Live'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {role === 'FARMER' && selectedBid.status === 'ACCEPTED' && (
                    <button
                      onClick={() => {
                        setComplaintForm({
                          title: lang === 'BN' 
                            ? `অভিযোগ: ${selectedBid.mill.millName}` 
                            : `Complaint against Mill: ${selectedBid.mill.millName}`,
                          description: '',
                          targetUserId: selectedBid.mill.id,
                          transactionId: '',
                          listingId: selectedBid.listingId,
                          district: selectedBid.listing?.district || '',
                          upazila: ''
                        })
                        setShowNewComplaintModal(true)
                      }}
                      className="p-1.5 hover:bg-danger/10 rounded-custom transition-all bg-transparent border-none cursor-pointer flex items-center justify-center"
                      title={lang === 'BN' ? 'অভিযোগ করুন' : 'File Complaint'}
                    >
                      <AlertTriangle className="w-4 h-4 text-danger" />
                    </button>
                  )}
                  <button 
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/bids?bidId=${selectedBid.id}&t=${Date.now()}`, { cache: 'no-store' })
                        if (res.ok) {
                          const currentBid = await res.json()
                          if (currentBid && currentBid.messages) {
                            setSelectedBid(prev => {
                              if (!prev) return null
                              
                              const incomingMessages = currentBid.messages || []
                              const localMessages = prev.messages || []
                              
                              const merged: any[] = [...incomingMessages]
                              const tempMessages = localMessages.filter(msg => msg.id.startsWith('temp-'))
                              for (const temp of tempMessages) {
                                const alreadyReceived = incomingMessages.some((srv: any) => 
                                  srv.senderId === temp.senderId &&
                                  srv.message === temp.message &&
                                  Math.abs(new Date(srv.createdAt).getTime() - new Date(temp.createdAt).getTime()) < 300000
                                )
                                if (!alreadyReceived) {
                                  merged.push(temp)
                                }
                              }
                              
                              merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                              
                              const hasChanged = 
                                prev.status !== currentBid.status ||
                                prev.pricePerMaund !== currentBid.pricePerMaund ||
                                JSON.stringify(prev.messages) !== JSON.stringify(merged)
                              
                              if (!hasChanged) return prev
                              
                              return { 
                                ...prev, 
                                status: currentBid.status, 
                                pricePerMaund: currentBid.pricePerMaund,
                                totalPrice: currentBid.totalPrice,
                                messages: merged 
                              }
                            })
                            addToast('success', lang === 'BN' ? 'বার্তা আপডেট করা হয়েছে' : 'Messages refreshed')
                          }
                        }
                      } catch (err) {
                        console.error('Error refreshing messages:', err)
                        addToast('error', lang === 'BN' ? 'আপডেট করতে ব্যর্থ' : 'Failed to refresh')
                      }
                    }}
                    className="p-1.5 hover:bg-text-secondary/10 rounded-custom transition-all bg-transparent border-none cursor-pointer"
                    title={lang === 'BN' ? 'রিফ্রেশ' : 'Refresh'}
                  >
                    <Activity className="w-4 h-4 text-brand-green" />
                  </button>
                  <button className="text-text-secondary/80 hover:text-text-primary bg-transparent border-none cursor-pointer" onClick={() => setShowNegotiationDrawer(false)}>
                    <XCircle className="w-5.5 h-5.5" />
                  </button>
                </div>
              </div>
              <div className="bg-background border border-text-secondary/5 p-3 rounded-custom mt-4 text-xs flex flex-col gap-1">
                <span className="font-bold text-text-primary">{selectedBid.mill.millName}</span>
                <span>Active Crop Target: <strong>{selectedBid.listing?.variety || 'Paddy Grain'}</strong></span>
                <span>Current Price Bid: <strong className="font-mono text-brand-green">{formatTaka(selectedBid.pricePerMaund)}/maund</strong></span>
              </div>
            </div>

            {/* Chat Messages Log */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto my-4 p-3 bg-background border border-text-secondary/5 rounded-custom flex flex-col gap-3 min-h-0">
              {selectedBid.notes && (
                <div className="self-start bg-text-secondary/5 text-text-primary p-2.5 rounded-custom text-xs max-w-[85%] border border-text-secondary/5">
                  <div className="font-bold text-[10px] text-text-secondary uppercase mb-0.5">Mill Initial Pitch</div>
                  {selectedBid.notes}
                </div>
              )}
              {selectedBid.messages && selectedBid.messages.map((msg: any) => {
                const isMe = msg.senderId === authUser?.id
                const isSending = msg.id.startsWith('temp-')
                return (
                  <div 
                    key={msg.id}
                    className={`p-2.5 rounded-custom text-xs max-w-[85%] border ${
                      isMe 
                        ? 'self-end bg-brand-green/10 text-text-primary border-brand-green/20' 
                        : 'self-start bg-surface border-text-secondary/10 text-text-primary'
                    } ${isSending ? 'opacity-70' : ''}`}
                  >
                    <div className="font-bold text-[9px] text-text-secondary uppercase mb-0.5 flex items-center gap-1">
                      {msg.senderRole}
                      {isSending && (
                        <span className="flex items-center gap-1 text-[8px] text-text-secondary/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
                          {lang === 'BN' ? 'পাঠানো হচ্ছে...' : 'Sending...'}
                        </span>
                      )}
                    </div>
                    <div>{msg.message}</div>
                    {msg.priceOffered && (
                      <div className="mt-1.5 p-1 bg-background/50 rounded font-bold font-mono text-[10px] text-brand-green">
                        Offered revised price: {formatTaka(msg.priceOffered)}/maund
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Send Interface */}
            <div className="border-t border-text-secondary/10 pt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t.offerPriceLabel}</label>
                <input 
                  type="number"
                  placeholder="ঐচ্ছিক"
                  value={chatInputPrice}
                  onChange={e => setChatInputPrice(e.target.value)}
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-1.5 text-xs font-mono text-text-primary focus:border-brand-green outline-none animate-slide-up"
                />
              </div>
              <div className="flex gap-2 items-center">
                <input 
                  type="text"
                  placeholder={t.chatPlaceholder}
                  value={chatInputText}
                  onChange={e => setChatInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendNegotiationMessage()
                    }
                  }}
                  className="flex-1 bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-xs text-text-primary focus:border-brand-green outline-none"
                />
                <button 
                  onClick={handleSendNegotiationMessage}
                  disabled={sendingMessage}
                  className="p-2 bg-brand-green hover:bg-brand-dark text-background rounded-custom border-none cursor-pointer flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingMessage ? (
                    <div className="w-4.5 h-4.5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-background" />
                  )}
                </button>
              </div>
              {role === 'FARMER' && selectedBid.status === 'PENDING' && (
                <button 
                  onClick={() => handleAcceptBid(selectedBid.id)}
                  disabled={acceptingBidId === selectedBid.id}
                  className="w-full mt-2 py-2 bg-brand-green text-background hover:bg-brand-dark text-xs font-bold rounded-custom border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4 text-background" /> {acceptingBidId === selectedBid.id ? (lang === 'BN' ? 'গ্রহণ করা হচ্ছে...' : 'Accepting...') : t.actionAccept}
                </button>
              )}
              {role === 'FARMER' && selectedBid.status === 'ACCEPTED' && (
                <button 
                  onClick={() => {
                    setComplaintForm({
                      title: lang === 'BN' 
                        ? `অভিযোগ: ${selectedBid.mill.millName}` 
                        : `Complaint against Mill: ${selectedBid.mill.millName}`,
                      description: '',
                      targetUserId: selectedBid.mill.id,
                      transactionId: '',
                      listingId: selectedBid.listingId,
                      district: selectedBid.listing?.district || '',
                      upazila: ''
                    })
                    setShowNewComplaintModal(true)
                  }}
                  className="w-full mt-2 py-2 bg-danger text-background hover:bg-danger/90 text-xs font-bold rounded-custom border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-md transition-all"
                >
                  <AlertTriangle className="w-4 h-4 text-background" /> {lang === 'BN' ? 'অভিযোগ করুন' : 'Complain About Mill'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Complaint Modal */}
      {showNewComplaintModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowNewComplaintModal(false)}>
          <div className="bg-surface border border-text-secondary/15 rounded-custom shadow-xl max-w-md w-full p-6 animate-scale-in flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black flex items-center gap-2"><FileText className="w-5 h-5 text-brand-green" /> {lang === 'BN' ? 'নতুন অভিযোগ দায়ের' : 'File New Complaint'}</h2>
              <button className="text-text-secondary/80 hover:text-text-primary bg-transparent border-none cursor-pointer" onClick={() => setShowNewComplaintModal(false)}>
                <XCircle className="w-5.5 h-5.5" />
              </button>
            </div>
            <form onSubmit={handleCreateComplaint} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'শিরোনাম' : 'Title'}</label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'BN' ? 'অভিযোগের সংক্ষিপ্ত শিরোনাম' : 'Brief complaint title'}
                  value={complaintForm.title}
                  onChange={e => setComplaintForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'বিবরণ' : 'Description'}</label>
                <textarea
                  required
                  rows={4}
                  placeholder={lang === 'BN' ? 'অভিযোগের বিস্তারিত বিবরণ লিখুন...' : 'Describe the complaint in detail...'}
                  value={complaintForm.description}
                  onChange={e => setComplaintForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-sm text-text-primary resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.district}</label>
                  <input
                    type="text"
                    placeholder={lang === 'BN' ? 'জেলা' : 'District'}
                    value={complaintForm.district}
                    onChange={e => setComplaintForm(prev => ({ ...prev, district: e.target.value }))}
                    className="w-full bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-sm text-text-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t.upazila}</label>
                  <input
                    type="text"
                    placeholder={lang === 'BN' ? 'উপজেলা' : 'Upazila'}
                    value={complaintForm.upazila}
                    onChange={e => setComplaintForm(prev => ({ ...prev, upazila: e.target.value }))}
                    className="w-full bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-sm text-text-primary"
                  />
                </div>
              </div>
              <div className="bg-brand-green/5 border border-brand-green/20 rounded-custom p-3">
                <p className="text-xs text-brand-green font-semibold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  {lang === 'BN' ? 'AI স্বয়ংক্রিয়ভাবে বিভাগ, অগ্রাধিকার এবং ফ্রড স্কোর বিশ্লেষণ করবে।' : 'AI will automatically analyze category, priority, and fraud score.'}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowNewComplaintModal(false)} className="flex-1 bg-transparent border border-text-secondary/20 hover:bg-text-secondary/10 text-text-primary text-sm font-bold py-2.5 rounded-custom cursor-pointer">
                  {t.cancelBtn}
                </button>
                <button type="submit" className="flex-1 bg-brand-green hover:bg-brand-dark text-background text-sm font-bold py-2.5 rounded-custom border-none cursor-pointer shadow-md">
                  {lang === 'BN' ? 'দায়ের করুন' : 'File Complaint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complaint Details Modal */}
      {showComplaintDetailsModal && viewingComplaint && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowComplaintDetailsModal(false)}>
          <div className="bg-surface border border-text-secondary/15 rounded-custom shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 animate-scale-in flex flex-col gap-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-text-secondary/10 pb-3">
              <h2 className="text-lg font-black flex items-center gap-2 text-brand-green">
                <FileText className="w-5 h-5 text-brand-green" /> 
                {lang === 'BN' ? 'অভিযোগের বিবরণ' : 'Complaint Details'}
              </h2>
              <button className="text-text-secondary/80 hover:text-text-primary bg-transparent border-none cursor-pointer" onClick={() => setShowComplaintDetailsModal(false)}>
                <XCircle className="w-5.5 h-5.5" />
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-3 bg-background border border-text-secondary/5 rounded-custom">
                <div className="text-[10px] font-bold text-text-secondary uppercase">{lang === 'BN' ? 'অভিযোগকারী কৃষক' : 'Filed By (Farmer)'}</div>
                <div className="font-bold text-text-primary mt-1 text-sm">{viewingComplaint.filedByUser?.name || 'N/A'}</div>
                <div className="text-xs text-text-secondary mt-0.5 font-mono">{viewingComplaint.filedByUser?.phone || 'N/A'}</div>
                {viewingComplaint.filedByUser?.district && <div className="text-xs text-text-secondary mt-0.5">District: {viewingComplaint.filedByUser.district}</div>}
              </div>
              <div className="p-3 bg-background border border-text-secondary/5 rounded-custom">
                <div className="text-[10px] font-bold text-text-secondary uppercase">{lang === 'BN' ? 'অভিযুক্ত মিল' : 'Accused (Mill Owner)'}</div>
                <div className="font-bold text-text-primary mt-1 text-sm">{viewingComplaint.targetUser?.name || 'N/A'}</div>
                <div className="text-xs text-text-secondary mt-0.5 font-mono">{viewingComplaint.targetUser?.phone || 'N/A'}</div>
                {viewingComplaint.targetUserId && (
                  <button
                    onClick={() => {
                      setCardTarget({
                        userId: viewingComplaint.targetUserId,
                        name: viewingComplaint.targetUser?.name || 'Mill Owner'
                      })
                      setShowCardModal(true)
                    }}
                    className="mt-2 text-[10px] bg-warning/10 hover:bg-warning/20 text-warning font-bold py-1 px-2.5 rounded border border-warning/20 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> {lang === 'BN' ? 'কার্ড জারি করুন' : 'Issue Governance Card'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] font-bold text-text-secondary uppercase">{lang === 'BN' ? 'অভিযোগ শিরোনাম' : 'Complaint Title'}</div>
              <div className="text-sm font-bold text-text-primary bg-background p-2.5 border border-text-secondary/5 rounded-custom">{viewingComplaint.title}</div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] font-bold text-text-secondary uppercase">{lang === 'BN' ? 'অভিযোগের বিবরণ' : 'Description'}</div>
              <div className="text-xs text-text-primary bg-background p-3 border border-text-secondary/5 rounded-custom whitespace-pre-wrap leading-relaxed">{viewingComplaint.description}</div>
            </div>

            <div className="border-t border-text-secondary/15 pt-4 flex flex-col gap-4">
              <h3 className="text-sm font-black text-brand-green flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-brand-green" /> 
                {lang === 'BN' ? 'এআই ট্রায়াজ এবং বিশ্লেষণ' : 'AI Triage & Analysis'}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="bg-background border border-text-secondary/5 p-2 rounded-custom">
                  <div className="text-[9px] font-bold text-text-secondary uppercase">Priority</div>
                  <div className="text-xs font-bold text-danger uppercase mt-1">{viewingComplaint.aiPriority || viewingComplaint.priority || 'N/A'}</div>
                </div>
                <div className="bg-background border border-text-secondary/5 p-2 rounded-custom">
                  <div className="text-[9px] font-bold text-text-secondary uppercase">Category</div>
                  <div className="text-xs font-bold text-info uppercase mt-1">{viewingComplaint.aiCategory || viewingComplaint.category || 'N/A'}</div>
                </div>
                <div className="bg-background border border-text-secondary/5 p-2 rounded-custom">
                  <div className="text-[9px] font-bold text-text-secondary uppercase">Fraud Score</div>
                  <div className="text-xs font-mono font-bold text-warning mt-1">{viewingComplaint.aiFraudScore || 0}%</div>
                </div>
                <div className="bg-background border border-text-secondary/5 p-2 rounded-custom">
                  <div className="text-[9px] font-bold text-text-secondary uppercase">Status</div>
                  <div className="text-xs font-bold text-text-primary uppercase mt-1">{viewingComplaint.status || 'N/A'}</div>
                </div>
              </div>

              {viewingComplaint.aiSummary && (
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] font-bold text-text-secondary uppercase">{lang === 'BN' ? 'এআই সংক্ষিপ্ত বিবরণ' : 'AI Summary'}</div>
                  <div className="text-xs text-text-primary bg-brand-green/5 p-2.5 border border-brand-green/10 rounded-custom leading-relaxed">{viewingComplaint.aiSummary}</div>
                </div>
              )}

              {viewingComplaint.aiSuggestion && (
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] font-bold text-text-secondary uppercase">{lang === 'BN' ? 'এআই প্রস্তাবিত পদক্ষেপ' : 'AI Suggestion'}</div>
                  <div className="text-xs text-text-primary bg-info/5 p-2.5 border border-info/10 rounded-custom leading-relaxed">{viewingComplaint.aiSuggestion}</div>
                </div>
              )}
            </div>

            <div className="border-t border-text-secondary/15 pt-4 flex flex-col gap-4">
              <h3 className="text-sm font-black text-text-primary">
                {lang === 'BN' ? 'রুলিং ও আপডেট' : 'Ruling & Updates'}
              </h3>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'অবস্থা পরিবর্তন করুন' : 'Change Status'}</label>
                <select
                  value={viewingComplaint.status}
                  onChange={e => setViewingComplaint({ ...viewingComplaint, status: e.target.value })}
                  className="bg-background border border-text-secondary/15 rounded-custom px-3 py-2 text-sm text-text-primary focus:border-brand-green outline-none cursor-pointer"
                >
                  <option value="pending">PENDING</option>
                  <option value="under_review">UNDER_REVIEW</option>
                  <option value="resolved">RESOLVED</option>
                  <option value="dismissed">DISMISSED</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'অ্যাডমিন নোটস' : 'Admin Notes'}</label>
                <textarea
                  rows={3}
                  placeholder={lang === 'BN' ? 'রুলিং এর বিবরণ বা নোটস লিখুন...' : 'Write dispute notes or admin ruling details...'}
                  value={adminNotesText}
                  onChange={e => setAdminNotesText(e.target.value)}
                  className="w-full bg-background border border-text-secondary/15 focus:border-brand-green outline-none rounded-custom px-3 py-2 text-sm text-text-primary resize-none"
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowComplaintDetailsModal(false)}
                  className="flex-1 bg-transparent border border-text-secondary/20 hover:bg-text-secondary/10 text-text-primary text-sm font-bold py-2.5 rounded-custom cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleUpdateComplaintStatus(viewingComplaint.id, viewingComplaint.status, adminNotesText)
                    setShowComplaintDetailsModal(false)
                  }}
                  className="flex-1 bg-brand-green hover:bg-brand-dark text-background text-sm font-bold py-2.5 rounded-custom border-none cursor-pointer shadow-md transition-all"
                >
                  {lang === 'BN' ? 'আপডেট সংরক্ষণ করুন' : 'Save Ruling'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mill Transaction History Modal */}
      {showMillHistoryModal && selectedMillForHistory && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowMillHistoryModal(false)}>
          <div className="bg-surface border border-text-secondary/15 rounded-custom shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-text-secondary/15">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-green" />
                {lang === 'BN' ? 'মিল লেনদেন ইতিহাস' : 'Mill Transaction History'}: {selectedMillForHistory.name}
              </h2>
              <button className="text-text-secondary/80 hover:text-text-primary bg-transparent border-none cursor-pointer" onClick={() => setShowMillHistoryModal(false)}>
                <XCircle className="w-5.5 h-5.5" />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-6">
              {millHistoryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
                  <span className="ml-3 text-text-secondary">{lang === 'BN' ? 'লোড হচ্ছে...' : 'Loading...'}</span>
                </div>
              ) : millTransactionHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-text-secondary/35 mx-auto mb-4" />
                  <p className="text-text-secondary">{lang === 'BN' ? 'কোনো লেনদেন ইতিহাস নেই' : 'No transaction history found'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-text-secondary/5 border-b border-text-secondary/10">
                        <th className="p-3 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'তারিখ' : 'Date'}</th>
                        <th className="p-3 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'কৃষক' : 'Farmer'}</th>
                        <th className="p-3 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'জেলা' : 'District'}</th>
                        <th className="p-3 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'ধানের জাত' : 'Variety'}</th>
                        <th className="p-3 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'পরিমাণ' : 'Quantity'}</th>
                        <th className="p-3 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'চূড়ান্ত মূল্য' : 'Final Price'}</th>
                        <th className="p-3 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'মোট মূল্য' : 'Total'}</th>
                        <th className="p-3 text-xs font-bold text-text-secondary uppercase tracking-wider">{lang === 'BN' ? 'অবস্থা' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {millTransactionHistory.map((tx) => (
                        <tr key={tx.id} className="border-b border-text-secondary/5 hover:bg-text-secondary/5 transition-all">
                          <td className="p-3 text-xs font-mono">{new Date(tx.createdAt).toLocaleDateString()}</td>
                          <td className="p-3 text-sm font-bold">{tx.farmerName}</td>
                          <td className="p-3 text-xs">{tx.farmerDistrict}</td>
                          <td className="p-3 text-sm">{tx.variety}</td>
                          <td className="p-3 text-xs font-mono">{tx.quantityMaund.toFixed(1)} {t.maund}</td>
                          <td className="p-3 text-sm font-mono text-brand-green">{formatTaka(tx.finalPrice)}/{t.maund}</td>
                          <td className="p-3 text-sm font-mono font-bold">{formatTaka(tx.totalAmount)}</td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                tx.paymentStatus === 'completed' ? 'bg-success/10 text-success border-success/20' :
                                tx.paymentStatus === 'partial' ? 'bg-warning/10 text-warning border-warning/20' :
                                'bg-text-secondary/10 text-text-secondary border-text-secondary/20'
                              }`}>
                                {lang === 'BN' ? 'পেমেন্ট' : 'Payment'}: {tx.paymentStatus}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                tx.deliveryStatus === 'delivered' ? 'bg-success/10 text-success border-success/20' :
                                tx.deliveryStatus === 'in_transit' ? 'bg-info/10 text-info border-info/20' :
                                'bg-text-secondary/10 text-text-secondary border-text-secondary/20'
                              }`}>
                                {lang === 'BN' ? 'ডেলিভারি' : 'Delivery'}: {tx.deliveryStatus}
                              </span>
                              {tx.priceRevised && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-warning/10 text-warning border-warning/20">
                                  {lang === 'BN' ? 'মূল্য পরিবর্তিত' : 'Price Revised'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="border-t border-text-secondary/15 p-4 bg-background/50">
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>{lang === 'BN' ? 'মোট লেনদেন' : 'Total Transactions'}: {millTransactionHistory.length}</span>
                <span>{lang === 'BN' ? 'শেষ ৫০টি লেনদেন দেখানো হচ্ছে' : 'Showing last 50 transactions'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
