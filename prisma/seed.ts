// ═══════════════════════════════════════════════════════════════
// KrishiDam — Database Setup & Seeding (Clean Production Baseline)
// Wipes demo listings/transactions and initializes core system configs
// ═══════════════════════════════════════════════════════════════

import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const connectionString = process.env.DATABASE_URL || 'postgresql://somoy@localhost:5432/postgres'
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Clearing all demo data and initializing system baseline...')

  // Clean existing data in order of dependency
  await prisma.platformSettings.deleteMany()
  await prisma.adminAction.deleteMany()
  await prisma.millCard.deleteMany()
  await prisma.notificationLog.deleteMany()
  await prisma.priceFloorCache.deleteMany()
  await prisma.govtPrice.deleteMany()
  await prisma.millInventory.deleteMany()
  await prisma.priceRevision.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.negotiationMessage.deleteMany()
  await prisma.contactRequest.deleteMany()
  await prisma.cropListing.deleteMany()
  await prisma.farmerProfile.deleteMany()
  await prisma.millProfile.deleteMany()
  await prisma.user.deleteMany()

  // ─── PLATFORM SETTINGS (MONETIZATION DEFAULTS) ───────────────────────
  const settings = [
    { key: 'mill_subscription_monthly', value: '500', description: 'Monthly subscription fee for mills (BDT). Free tier mills can view but not send contact requests.' },
    { key: 'transaction_fee_pct', value: '0.5', description: 'Platform transaction fee as percentage of total deal value. Deducted from mill payment via bKash/Nagad.' },
    { key: 'featured_listing_price', value: '50', description: 'Price for farmers to boost listing to top of mill feed for 48 hours (BDT). [Future feature]' },
    { key: 'listing_expiry_days', value: '7', description: 'Number of days before active listings automatically expire.' },
    { key: 'max_yellow_cards_before_red', value: '3', description: 'Maximum yellow cards within 30 days before automatic red card and suspension.' },
    { key: 'price_revision_compliance_limit', value: '5', description: 'Maximum percentage variance allowed before transaction auto-flagging.' },
  ]

  for (const s of settings) {
    await prisma.platformSettings.create({ data: s })
  }
  console.log('  Platform settings initialized (6 monetization config keys)')

  // ─── INSTALL DATABASE TRIGGERS ───────────────────────────────────────
  console.log('Installing PostgreSQL triggers and functions...')
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION check_crop_listing_price()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.expected_min_price < NEW.ai_floor_price THEN
        RAISE EXCEPTION 'আপনার সর্বনিম্ন মূল্য AI-নির্ধারিত ন্যূনতম মূল্যের নিচে হতে পারবে না।';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trig_check_crop_listing_price ON crop_listings;
    CREATE TRIGGER trig_check_crop_listing_price
    BEFORE INSERT OR UPDATE ON crop_listings
    FOR EACH ROW
    EXECUTE FUNCTION check_crop_listing_price();


    -- Update contact request check function to handle nulls
    CREATE OR REPLACE FUNCTION check_contact_request()
    RETURNS TRIGGER AS $$
    DECLARE
      v_ai_floor DECIMAL;
      v_suspended BOOLEAN;
    BEGIN
      SELECT ai_floor_price INTO v_ai_floor FROM crop_listings WHERE id = NEW.listing_id;
      IF v_ai_floor IS NOT NULL AND NEW.offered_price < v_ai_floor THEN
        RAISE EXCEPTION 'Your offer is below the AI-calculated fair floor for this crop.';
      END IF;

      SELECT suspended INTO v_suspended FROM mill_profiles WHERE id = NEW.mill_id;
      IF v_suspended = true THEN
        RAISE EXCEPTION 'এই মিলটি বর্তমানে স্থগিত।';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trig_check_contact_request ON contact_requests;
    CREATE TRIGGER trig_check_contact_request
    BEFORE INSERT OR UPDATE ON contact_requests
    FOR EACH ROW
    EXECUTE FUNCTION check_contact_request();

    CREATE OR REPLACE FUNCTION check_transaction_price_revision()
    RETURNS TRIGGER AS $$
    DECLARE
      v_revision_exists BOOLEAN;
      v_yellow_count INT;
      v_card_id UUID;
    BEGIN
      IF NEW.final_price < NEW.agreed_price THEN
        NEW.price_revised := true;

        SELECT EXISTS(
          SELECT 1 FROM price_revisions 
          WHERE transaction_id = NEW.id
        ) INTO v_revision_exists;

        IF NOT v_revision_exists THEN
          INSERT INTO price_revisions (id, transaction_id, mill_id, original_price, revised_price, reason, farmer_disputed, admin_reviewed, created_at)
          VALUES (gen_random_uuid(), NEW.id, NEW.mill_id, NEW.agreed_price, NEW.final_price, COALESCE(NEW.revision_reason, 'Price revision at delivery'), true, false, now());
        END IF;

        v_card_id := gen_random_uuid();
        INSERT INTO mill_cards (id, mill_id, card_type, reason_type, transaction_id, description, auto_generated, overridden, created_at)
        VALUES (v_card_id, NEW.mill_id, 'yellow', 'price_revision', NEW.id, 'Automatic yellow card issued due to price reduction below agreed amount.', true, false, now());

        UPDATE users SET trust_score = GREATEST(0, trust_score - 10) WHERE id = NEW.mill_id;

        SELECT COUNT(*) INTO v_yellow_count 
        FROM mill_cards 
        WHERE mill_id = NEW.mill_id 
          AND card_type = 'yellow' 
          AND overridden = false 
          AND created_at >= (now() - INTERVAL '30 days');

        IF v_yellow_count >= 3 THEN
          INSERT INTO mill_cards (id, mill_id, card_type, reason_type, transaction_id, description, auto_generated, overridden, created_at)
          VALUES (gen_random_uuid(), NEW.mill_id, 'red', 'price_revision', NEW.id, 'Automatic red card issued: 3 yellow cards accumulated within 30 days.', true, false, now());

          UPDATE users SET trust_score = 0 WHERE id = NEW.mill_id;

          UPDATE mill_profiles 
          SET suspended = true, 
              suspension_reason = 'Suspended automatically: 3 yellow cards in 30 days.', 
              suspended_at = now()
          WHERE id = NEW.mill_id;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trig_transaction_price_revision ON transactions;
    CREATE TRIGGER trig_transaction_price_revision
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION check_transaction_price_revision();
  `)
  console.log('  Triggers successfully installed')

  // ─── INSTALL SUPABASE RLS POLICIES ───────────────────────────────────
  console.log('Installing Supabase Row Level Security policies...')
  try {
    await prisma.$executeRawUnsafe(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
        SELECT NULL::uuid;
      $$ LANGUAGE sql STABLE;
    `)
  } catch (err) {
    console.log('  Using native Supabase auth schema.')
  }

  await prisma.$executeRawUnsafe(`
    -- Enable RLS on all major tables
    ALTER TABLE crop_listings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;
    ALTER TABLE negotiation_messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE mill_inventory ENABLE ROW LEVEL SECURITY;
    ALTER TABLE govt_prices ENABLE ROW LEVEL SECURITY;
    ALTER TABLE mill_cards ENABLE ROW LEVEL SECURITY;
    ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

    -- crop_listings: farmers see own, mills/public see active
    DROP POLICY IF EXISTS crop_listings_farmer_own ON crop_listings;
    CREATE POLICY crop_listings_farmer_own ON crop_listings FOR SELECT USING (farmer_id = auth.uid() OR status = 'active');
    DROP POLICY IF EXISTS crop_listings_insert ON crop_listings;
    CREATE POLICY crop_listings_insert ON crop_listings FOR INSERT WITH CHECK (farmer_id = auth.uid());

    -- contact_requests: farmer sees received, mill sees sent, admin sees all
    DROP POLICY IF EXISTS contact_requests_select ON contact_requests;
    CREATE POLICY contact_requests_select ON contact_requests FOR SELECT USING (farmer_id = auth.uid() OR mill_id = auth.uid());
    DROP POLICY IF EXISTS contact_requests_insert ON contact_requests;
    CREATE POLICY contact_requests_insert ON contact_requests FOR INSERT WITH CHECK (mill_id = auth.uid());

    -- negotiation_messages: only parties to that request
    DROP POLICY IF EXISTS negotiation_messages_select ON negotiation_messages;
    CREATE POLICY negotiation_messages_select ON negotiation_messages FOR SELECT USING (sender_id = auth.uid() OR request_id IN (SELECT id FROM contact_requests WHERE farmer_id = auth.uid() OR mill_id = auth.uid()));

    -- transactions: parties see own, public sees completed
    DROP POLICY IF EXISTS transactions_select ON transactions;
    CREATE POLICY transactions_select ON transactions FOR SELECT USING (farmer_id = auth.uid() OR mill_id = auth.uid() OR delivery_status = 'confirmed');

    -- mill_inventory: mill sees own, public sees visible
    DROP POLICY IF EXISTS mill_inventory_select ON mill_inventory;
    CREATE POLICY mill_inventory_select ON mill_inventory FOR SELECT USING (mill_id = auth.uid() OR public_visible = true);
    DROP POLICY IF EXISTS mill_inventory_modify ON mill_inventory;
    CREATE POLICY mill_inventory_modify ON mill_inventory FOR ALL USING (mill_id = auth.uid());

    -- govt_prices: everyone reads, only admin writes
    DROP POLICY IF EXISTS govt_prices_read ON govt_prices;
    CREATE POLICY govt_prices_read ON govt_prices FOR SELECT USING (true);

    -- mill_cards: public reads all
    DROP POLICY IF EXISTS mill_cards_read ON mill_cards;
    CREATE POLICY mill_cards_read ON mill_cards FOR SELECT USING (true);

    -- users: own profile, public reads mill profiles
    DROP POLICY IF EXISTS users_own ON users;
    CREATE POLICY users_own ON users FOR SELECT USING (id = auth.uid() OR role = 'mill');

    -- platform_settings: public reads non-sensitive
    DROP POLICY IF EXISTS platform_settings_read ON platform_settings;
    CREATE POLICY platform_settings_read ON platform_settings FOR SELECT USING (true);
  `)
  console.log('  RLS policies installed')

  console.log('\nDatabase baseline configured successfully! Ready for production data.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
