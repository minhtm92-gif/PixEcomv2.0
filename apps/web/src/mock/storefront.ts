// ── Storefront mock data (PREVIEW ONLY — no API calls) ─────────────────────

export interface MockVariantOption {
  label: string;
  value: string;
  color?: string; // hex for color swatches
  available: boolean;
}

export interface MockVariant {
  name: string;
  options: MockVariantOption[];
}

export interface MockBoostModule {
  type: 'BUNDLE_DISCOUNT' | 'EXTRA_OFF';
  title: string;
  tiers?: { qty: number; discount: string }[];
  description?: string;
}

export interface MockStorefrontProduct {
  id: string;
  slug: string;
  name: string;
  rating: number;
  reviewCount: number;
  price: number;
  comparePrice: number;
  currency: string;
  images: string[];
  thumbnails: string[];
  variants: MockVariant[];
  boostModules: MockBoostModule[];
  description: string;
  shippingInfo: string;
  returnPolicy: string;
  socialProof: { viewers: number; purchased: number };
  category: 'CLEARANCE' | 'NEW_ARRIVALS' | 'BESTSELLERS';
  badge?: string;
}

export interface MockReview {
  id: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  verified: boolean;
}

export interface MockCheckoutDiscount {
  id: string;
  label: string;
  description: string;
  value: string;
  type: 'percentage' | 'fixed';
  amount: number;
}

export interface MockStoreConfig {
  id: string;
  name: string;
  slug: string;
  domain: string;
  tagline: string;
  primaryColor: string;
  promoMessage: string;
  promoEndHours: number;
  currency: string;
  shippingThreshold: number;
  socialLinks: { instagram?: string; facebook?: string; tiktok?: string };
  policies: { shipping: string; returns: string; privacy: string; terms: string };
}

export interface MockCartItem {
  id: string;
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  qty: number;
  variant?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export const STORE_CONFIG: MockStoreConfig = {
  id: 'store_demo01',
  name: 'LynsieCharm',
  slug: 'demo-store',
  domain: 'demo-store.pixecom.store',
  tagline: 'Charm Your World, One Piece at a Time',
  primaryColor: '#9333ea',
  promoMessage: '🚚 FREE SHIPPING on orders over $50 · ✨ FLASH SALE — up to 60% OFF today only',
  promoEndHours: 2,
  currency: 'USD',
  shippingThreshold: 50,
  socialLinks: { instagram: '#', facebook: '#', tiktok: '#' },
  policies: {
    shipping: `**Standard Shipping (5-7 business days):** Free on orders over $50. $4.99 flat rate otherwise.\n\n**Express Shipping (2-3 business days):** $12.99 flat rate.\n\n**Overnight Shipping:** $24.99 flat rate.\n\nAll orders are processed within 1-2 business days. Orders placed on weekends or holidays will be processed the next business day. Tracking information is emailed once your order ships.`,
    returns: `We want you to love your purchase! If you're not completely satisfied, we accept returns within **30 days** of delivery.\n\n**How to return:** Email us at returns@lynsie-charm.com with your order number and reason for return. We'll send you a prepaid return label.\n\n**Refund:** Issued to original payment method within 5-7 business days of receiving your return.\n\n**Exchanges:** We offer free exchanges for size/color within 30 days.`,
    privacy: `**LynsieCharm Privacy Policy**\n\nWe collect only the information necessary to process your order and improve your shopping experience.\n\n**What we collect:** Name, email, shipping address, and payment information (processed securely by Stripe — we never see your full card details).\n\n**How we use it:** To fulfill orders, send shipping updates, and (with your consent) promotional emails.\n\n**We never sell your data.** We use industry-standard SSL encryption. You may request deletion of your data at any time by emailing privacy@lynsie-charm.com.`,
    terms: `**Terms of Service**\n\nBy accessing or purchasing from LynsieCharm, you agree to these terms.\n\n**Products:** All jewelry is handcrafted or carefully curated. Colors may vary slightly from photos due to screen settings.\n\n**Pricing:** All prices in USD and subject to change. We reserve the right to cancel orders in case of pricing errors.\n\n**Intellectual Property:** All content on this site is owned by LynsieCharm and may not be reproduced without permission.\n\n**Limitation of Liability:** LynsieCharm is not liable for incidental or consequential damages arising from product use.`,
  },
};

// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_PRODUCTS: MockStorefrontProduct[] = [
  {
    id: 'prod_001',
    slug: 'lynsie-charm-bracelet',
    name: 'Lynsie Charm Bracelet Set',
    rating: 4.8,
    reviewCount: 312,
    price: 38.99,
    comparePrice: 79.99,
    currency: 'USD',
    images: [
      'https://picsum.photos/seed/bracelet1/800/800',
      'https://picsum.photos/seed/bracelet2/800/800',
      'https://picsum.photos/seed/bracelet3/800/800',
      'https://picsum.photos/seed/bracelet4/800/800',
    ],
    thumbnails: [
      'https://picsum.photos/seed/bracelet1/200/200',
      'https://picsum.photos/seed/bracelet2/200/200',
      'https://picsum.photos/seed/bracelet3/200/200',
      'https://picsum.photos/seed/bracelet4/200/200',
    ],
    variants: [
      {
        name: 'Color',
        options: [
          { label: 'Gold', value: 'gold', color: '#D4AF37', available: true },
          { label: 'Silver', value: 'silver', color: '#C0C0C0', available: true },
          { label: 'Rose Gold', value: 'rose-gold', color: '#B76E79', available: true },
          { label: 'Black', value: 'black', color: '#1a1a1a', available: false },
        ],
      },
      {
        name: 'Size',
        options: [
          { label: 'XS (6")', value: 'xs', available: true },
          { label: 'S (6.5")', value: 's', available: true },
          { label: 'M (7")', value: 'm', available: true },
          { label: 'L (7.5")', value: 'l', available: true },
          { label: 'XL (8")', value: 'xl', available: false },
        ],
      },
    ],
    boostModules: [
      {
        type: 'BUNDLE_DISCOUNT',
        title: 'Buy More, Save More',
        tiers: [
          { qty: 2, discount: '10% off' },
          { qty: 3, discount: '15% off' },
          { qty: 5, discount: '25% off' },
        ],
      },
      {
        type: 'EXTRA_OFF',
        title: '🎁 Gift-Ready Packaging Included',
        description: 'Every set comes in a premium jewelry box — perfect for gifting.',
      },
    ],
    description: `The **Lynsie Charm Bracelet Set** is our best-selling signature collection — delicate, layerable, and designed to be worn every day.\n\nHandcrafted from 18K gold-plated brass with a waterproof coating, each bracelet features hand-set cubic zirconia charms that catch the light beautifully. The set includes 3 bracelets that can be stacked or worn individually.\n\n✅ Waterproof & tarnish-resistant\n✅ Hypoallergenic — nickel free\n✅ 18K gold / sterling silver / rose gold plating\n✅ Adjustable clasp fits most wrist sizes\n✅ Gift box included`,
    shippingInfo: 'Ships in 1-2 business days. Free shipping on orders over $50.',
    returnPolicy: '30-day hassle-free returns. See our full return policy for details.',
    socialProof: { viewers: 47, purchased: 1284 },
    category: 'BESTSELLERS',
    badge: '🔥 #1 Best Seller',
  },
  {
    id: 'prod_002',
    slug: 'crystal-drop-earrings',
    name: 'Crystal Drop Earrings',
    rating: 4.6,
    reviewCount: 189,
    price: 24.99,
    comparePrice: 49.99,
    currency: 'USD',
    images: [
      'https://picsum.photos/seed/earring1/800/800',
      'https://picsum.photos/seed/earring2/800/800',
      'https://picsum.photos/seed/earring3/800/800',
    ],
    thumbnails: [
      'https://picsum.photos/seed/earring1/200/200',
      'https://picsum.photos/seed/earring2/200/200',
      'https://picsum.photos/seed/earring3/200/200',
    ],
    variants: [
      {
        name: 'Crystal Color',
        options: [
          { label: 'Clear', value: 'clear', color: '#e8e8f0', available: true },
          { label: 'Blush Pink', value: 'pink', color: '#FFB6C1', available: true },
          { label: 'Ocean Blue', value: 'blue', color: '#4A90D9', available: true },
          { label: 'Emerald', value: 'green', color: '#2ECC71', available: true },
        ],
      },
    ],
    boostModules: [
      {
        type: 'EXTRA_OFF',
        title: '✨ New Arrival — 50% Off Launch Price',
        description: 'Limited time introductory offer. Original price $49.99.',
      },
    ],
    description: `Elegant Swarovski-inspired crystal drops in four stunning colors. 925 sterling silver posts — safe for sensitive ears. Light-catching facets that add instant glamour to any look.\n\n✅ 925 sterling silver posts\n✅ Hypoallergenic\n✅ Length: 2.5cm drop\n✅ Available in 4 crystal colors`,
    shippingInfo: 'Ships in 1-2 business days. Free shipping on orders over $50.',
    returnPolicy: '30-day returns accepted.',
    socialProof: { viewers: 23, purchased: 456 },
    category: 'NEW_ARRIVALS',
    badge: '✨ New Arrival',
  },
  {
    id: 'prod_003',
    slug: 'golden-layered-necklace',
    name: 'Golden Layered Necklace',
    rating: 4.5,
    reviewCount: 97,
    price: 19.99,
    comparePrice: 54.99,
    currency: 'USD',
    images: [
      'https://picsum.photos/seed/necklace1/800/800',
      'https://picsum.photos/seed/necklace2/800/800',
      'https://picsum.photos/seed/necklace3/800/800',
    ],
    thumbnails: [
      'https://picsum.photos/seed/necklace1/200/200',
      'https://picsum.photos/seed/necklace2/200/200',
      'https://picsum.photos/seed/necklace3/200/200',
    ],
    variants: [
      {
        name: 'Style',
        options: [
          { label: '2-Layer', value: '2layer', available: true },
          { label: '3-Layer', value: '3layer', available: true },
          { label: '4-Layer', value: '4layer', available: false },
        ],
      },
    ],
    boostModules: [
      {
        type: 'BUNDLE_DISCOUNT',
        title: 'Clearance Bundle Deal',
        tiers: [
          { qty: 2, discount: '20% off' },
          { qty: 3, discount: '30% off' },
        ],
      },
    ],
    description: `Multi-layer 18K gold-plated necklace with adjustable chains. Mix and match lengths for a curated, effortless look. Lightweight and comfortable for all-day wear.\n\n✅ 18K gold plated\n✅ Adjustable lengths: 14" / 16" / 18"\n✅ Anti-tarnish coating\n✅ Lobster clasp closure`,
    shippingInfo: 'Ships in 1-2 business days. Free shipping on orders over $50.',
    returnPolicy: '30-day returns accepted.',
    socialProof: { viewers: 12, purchased: 312 },
    category: 'CLEARANCE',
    badge: '🏷️ Clearance — 64% OFF',
  },
  {
    id: 'prod_004',
    slug: 'pearl-charm-set',
    name: 'Pearl & Chain Set',
    rating: 4.9,
    reviewCount: 241,
    price: 44.99,
    comparePrice: 89.99,
    currency: 'USD',
    images: [
      'https://picsum.photos/seed/pearl1/800/800',
      'https://picsum.photos/seed/pearl2/800/800',
      'https://picsum.photos/seed/pearl3/800/800',
    ],
    thumbnails: [
      'https://picsum.photos/seed/pearl1/200/200',
      'https://picsum.photos/seed/pearl2/200/200',
      'https://picsum.photos/seed/pearl3/200/200',
    ],
    variants: [
      {
        name: 'Metal',
        options: [
          { label: 'Gold', value: 'gold', color: '#D4AF37', available: true },
          { label: 'Silver', value: 'silver', color: '#C0C0C0', available: true },
        ],
      },
      {
        name: 'Set Includes',
        options: [
          { label: 'Necklace + Earrings', value: 'set2', available: true },
          { label: 'Full Set (+ Bracelet)', value: 'set3', available: true },
        ],
      },
    ],
    boostModules: [
      {
        type: 'EXTRA_OFF',
        title: '💎 Top Rated — 4.9 Stars',
        description: 'Our highest-rated collection. Loved by 241+ customers.',
      },
    ],
    description: `Timeless freshwater pearl jewelry with 18K gold or sterling silver settings. The full set includes a pearl strand necklace, matching stud earrings, and an optional pearl-chain bracelet.\n\n✅ Genuine freshwater pearls (7-8mm)\n✅ 18K gold or 925 sterling silver settings\n✅ Pearl luster graded A quality\n✅ Gift box + certificate of authenticity`,
    shippingInfo: 'Ships in 1-2 business days. Free shipping on orders over $50.',
    returnPolicy: '30-day hassle-free returns.',
    socialProof: { viewers: 31, purchased: 891 },
    category: 'BESTSELLERS',
    badge: '⭐ Top Rated',
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_REVIEWS: MockReview[] = [
  {
    id: 'rev_001',
    author: 'Sarah M.',
    rating: 5,
    date: 'Jan 15, 2026',
    title: 'Absolutely gorgeous! Better than expected.',
    body: 'I bought the gold set and it is stunning. The clasp is smooth and secure, and the charms are beautifully detailed. I\'ve received so many compliments. Will definitely order again.',
    verified: true,
  },
  {
    id: 'rev_002',
    author: 'Jenna K.',
    rating: 5,
    date: 'Jan 8, 2026',
    title: 'Perfect gift — arrived beautifully packaged',
    body: 'Ordered as a birthday gift for my daughter. The box presentation was elegant and she absolutely loved it. Great quality for the price. Ships fast too!',
    verified: true,
  },
  {
    id: 'rev_003',
    author: 'Maria T.',
    rating: 4,
    date: 'Dec 28, 2025',
    title: 'Love the rose gold — slight size issue resolved quickly',
    body: 'The rose gold color is beautiful and exactly as pictured. I ordered an M but needed an S — contacted support and they shipped a replacement the same day. Great customer service.',
    verified: true,
  },
  {
    id: 'rev_004',
    author: 'Ashley R.',
    rating: 5,
    date: 'Dec 12, 2025',
    title: 'Wear it every single day!',
    body: 'I have been wearing this bracelet daily for 3 months — it hasn\'t tarnished at all! Wore it in the shower, pool, gym. Incredibly durable for the price. This is my new everyday piece.',
    verified: true,
  },
  {
    id: 'rev_005',
    author: 'Lauren P.',
    rating: 4,
    date: 'Nov 30, 2025',
    title: 'Delicate and pretty, very wearable',
    body: 'Elegant and understated — exactly what I was looking for. The silver version is very bright and shiny. My only note is that the chain feels very fine, so be careful putting it on. Overall very happy.',
    verified: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_CHECKOUT_DISCOUNTS: MockCheckoutDiscount[] = [
  {
    id: 'disc_welcome',
    label: 'Welcome Discount',
    description: '10% off your first order — auto-applied at checkout',
    value: '10% OFF',
    type: 'percentage',
    amount: 10,
  },
  {
    id: 'disc_bundle',
    label: 'Bundle Saver',
    description: 'Extra $5 off when you buy 2 or more items',
    value: '$5 OFF',
    type: 'fixed',
    amount: 5,
  },
  {
    id: 'disc_flash',
    label: 'Flash Sale',
    description: 'Limited-time 15% off — today only',
    value: '15% OFF',
    type: 'percentage',
    amount: 15,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

// Sample cart for CartPanel preview
export const MOCK_SAMPLE_CART: MockCartItem[] = [
  {
    id: 'cart_1',
    productId: 'prod_001',
    slug: 'lynsie-charm-bracelet',
    name: 'Lynsie Charm Bracelet Set',
    image: 'https://picsum.photos/seed/bracelet1/200/200',
    price: 38.99,
    qty: 1,
    variant: 'Gold / M (7")',
  },
];
