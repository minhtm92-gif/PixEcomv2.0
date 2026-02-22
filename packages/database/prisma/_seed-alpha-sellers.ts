/**
 * Temporary script to create alpha sellers + sellpages.
 * This is the missing seed.alpha.ts dependency.
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Simple password hash (bcrypt-like but using crypto for no dep)
async function hashPw(pw: string): Promise<string> {
  // Use the same format bcryptjs uses — just create a simple hash for local testing
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pw, salt, 10000, 64, 'sha512').toString('hex');
  return `$pbkdf2$${salt}$${hash}`;
}

async function main() {
  // We need bcryptjs hash for the auth module to work
  // Import dynamically from the monorepo
  let bcryptHash: string;
  try {
    const bcrypt = await import('bcryptjs');
    bcryptHash = await bcrypt.hash('Alpha@123', 10);
  } catch {
    // Fallback: generate using node's crypto
    bcryptHash = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012';
    console.warn('⚠️  bcryptjs not found, using placeholder hash. Login will NOT work.');
    console.warn('   Run: cd apps/api && pnpm add bcryptjs');
  }

  console.log('🔧 Creating alpha sellers + users + sellpages...');

  // Seller 1
  await prisma.seller.upsert({
    where: { id: '00000000-A100-0001-0002-000000000001' },
    update: {},
    create: { id: '00000000-A100-0001-0002-000000000001', name: 'Alpha Store One', slug: 'alpha-store-one' }
  });
  await prisma.user.upsert({
    where: { email: 'alpha1@pixecom.io' },
    update: {},
    create: { id: '00000000-A100-0001-0001-000000000001', email: 'alpha1@pixecom.io', passwordHash: bcryptHash, displayName: 'Alpha One' }
  });
  await prisma.sellerUser.upsert({
    where: { uq_seller_user: { sellerId: '00000000-A100-0001-0002-000000000001', userId: '00000000-A100-0001-0001-000000000001' } },
    update: {},
    create: { sellerId: '00000000-A100-0001-0002-000000000001', userId: '00000000-A100-0001-0001-000000000001', role: 'OWNER' }
  });

  // Seller 2
  await prisma.seller.upsert({
    where: { id: '00000000-A200-0001-0002-000000000001' },
    update: {},
    create: { id: '00000000-A200-0001-0002-000000000001', name: 'Alpha Store Two', slug: 'alpha-store-two' }
  });
  await prisma.user.upsert({
    where: { email: 'alpha2@pixecom.io' },
    update: {},
    create: { id: '00000000-A200-0001-0001-000000000001', email: 'alpha2@pixecom.io', passwordHash: bcryptHash, displayName: 'Alpha Two' }
  });
  await prisma.sellerUser.upsert({
    where: { uq_seller_user: { sellerId: '00000000-A200-0001-0002-000000000001', userId: '00000000-A200-0001-0001-000000000001' } },
    update: {},
    create: { sellerId: '00000000-A200-0001-0002-000000000001', userId: '00000000-A200-0001-0001-000000000001', role: 'OWNER' }
  });

  // Products
  const prods = await prisma.product.findMany({ orderBy: { productCode: 'asc' } });
  const deskpad = prods.find(p => p.productCode === 'DESKPAD-001');
  const mouse = prods.find(p => p.productCode === 'MOUSE-001');
  const stand = prods.find(p => p.productCode === 'STAND-001');

  if (!mouse || !stand || !deskpad) {
    console.error('❌ Products not found. Run db:seed first.');
    process.exit(1);
  }

  // Sellpages for Seller 1
  await prisma.sellpage.upsert({ where: { id: '00000000-A100-0003-0001-000000000001' }, update: {}, create: { id: '00000000-A100-0003-0001-000000000001', sellerId: '00000000-A100-0001-0002-000000000001', productId: mouse.id, slug: 'alpha-store-one-mouse-deal', status: 'PUBLISHED', titleOverride: 'Alpha Store One — SlimPro Mouse Flash Sale' } });
  await prisma.sellpage.upsert({ where: { id: '00000000-A100-0003-0001-000000000002' }, update: {}, create: { id: '00000000-A100-0003-0001-000000000002', sellerId: '00000000-A100-0001-0002-000000000001', productId: stand.id, slug: 'alpha-store-one-stand-offer', status: 'PUBLISHED', titleOverride: 'Alpha Store One — ProStand Workspace Upgrade' } });
  await prisma.sellpage.upsert({ where: { id: '00000000-A100-0003-0001-000000000003' }, update: {}, create: { id: '00000000-A100-0003-0001-000000000003', sellerId: '00000000-A100-0001-0002-000000000001', productId: deskpad.id, slug: 'alpha-store-one-deskpad-promo', status: 'DRAFT' } });
  await prisma.sellpage.upsert({ where: { id: '00000000-A100-0003-0001-000000000004' }, update: {}, create: { id: '00000000-A100-0003-0001-000000000004', sellerId: '00000000-A100-0001-0002-000000000001', productId: mouse.id, slug: 'alpha-store-one-mouse-retarget', status: 'DRAFT', titleOverride: 'Special Offer — Limited Time' } });

  // Sellpages for Seller 2
  await prisma.sellpage.upsert({ where: { id: '00000000-A200-0003-0001-000000000001' }, update: {}, create: { id: '00000000-A200-0003-0001-000000000001', sellerId: '00000000-A200-0001-0002-000000000001', productId: mouse.id, slug: 'alpha-store-two-mouse-deal', status: 'PUBLISHED', titleOverride: 'Alpha Store Two — SlimPro Mouse Flash Sale' } });
  await prisma.sellpage.upsert({ where: { id: '00000000-A200-0003-0001-000000000002' }, update: {}, create: { id: '00000000-A200-0003-0001-000000000002', sellerId: '00000000-A200-0001-0002-000000000001', productId: stand.id, slug: 'alpha-store-two-stand-offer', status: 'PUBLISHED', titleOverride: 'Alpha Store Two — ProStand Workspace Upgrade' } });

  // Settings for sellers (needed for /settings page)
  await prisma.sellerSettings.upsert({
    where: { sellerId: '00000000-A100-0001-0002-000000000001' },
    update: {},
    create: { sellerId: '00000000-A100-0001-0002-000000000001', brandName: 'Alpha Store One', defaultCurrency: 'USD', timezone: 'Asia/Ho_Chi_Minh' }
  });
  await prisma.sellerSettings.upsert({
    where: { sellerId: '00000000-A200-0001-0002-000000000001' },
    update: {},
    create: { sellerId: '00000000-A200-0001-0002-000000000001', brandName: 'Alpha Store Two', defaultCurrency: 'USD', timezone: 'Asia/Ho_Chi_Minh' }
  });

  console.log('✅ Alpha sellers (2) + users (2) + sellpages (6) + settings (2) created');
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
