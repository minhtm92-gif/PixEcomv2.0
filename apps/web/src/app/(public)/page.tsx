import Link from 'next/link';
import {
  Target,
  Zap,
  Rocket,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  MousePointerClick,
  Globe,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────────────────────
 * PixEcom Marketing Landing Page
 *
 * Server Component — no 'use client' needed.
 * Tailwind CSS only, dark-themed, mobile-first.
 * ──────────────────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      {/* ─── Navigation ──────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-sm">
              P
            </div>
            <span className="text-lg font-bold tracking-tight">PixEcom</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white px-4 py-2 rounded-lg transition-all"
            >
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-32">
        {/* Background gradient glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-indigo-600/20 via-violet-600/10 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-zinc-400 mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Built for Vietnamese Dropshippers
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
            The Sellpage Builder{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              That Shows You Exactly
            </span>{' '}
            Which Ad Makes Money
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Build high-converting sellpages, track every Facebook ad click to purchase,
            and optimize your dropshipping business with real-time analytics.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="group flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-semibold px-8 py-3.5 rounded-xl text-lg transition-all shadow-lg shadow-indigo-500/25"
            >
              Start Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/pixelxlab-store-rs59b8"
              className="flex items-center gap-2 border border-white/10 hover:border-white/20 hover:bg-white/5 text-zinc-300 font-medium px-8 py-3.5 rounded-xl text-lg transition-all"
            >
              See Demo
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>

          {/* Trust line */}
          <p className="mt-6 text-sm text-zinc-500">
            No credit card required. Set up in under 5 minutes.
          </p>
        </div>
      </section>

      {/* ─── Stats Bar ───────────────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '10,000+', label: 'Orders Processed' },
            { value: '50+', label: 'Active Sellers' },
            { value: '<1s', label: 'Page Load Time' },
            { value: '99.9%', label: 'Uptime SLA' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Problem / Solution ──────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Stop Guessing,{' '}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Start Knowing
              </span>
            </h2>
            <p className="mt-4 text-zinc-400 max-w-2xl mx-auto text-lg">
              Every dropshipper faces the same problems. PixEcom solves all of them.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: MousePointerClick,
                problem: "Can't track which ad works",
                solution:
                  'PixEcom connects every Facebook ad click to every purchase, so you see exactly which creative, audience, and campaign generates revenue.',
              },
              {
                icon: Globe,
                problem: 'Generic Shopify pages kill conversions',
                solution:
                  'Build standalone sellpages optimized for single-product focus with built-in urgency timers, quantity discounts, and trust badges.',
              },
              {
                icon: Zap,
                problem: 'Slow page load loses customers',
                solution:
                  'PixEcom sellpages are lightweight, server-rendered, and load in under 1 second. No Shopify theme bloat, no app conflicts.',
              },
            ].map((item) => (
              <div
                key={item.problem}
                className="group relative bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-indigo-400" />
                </div>
                <p className="text-sm font-medium text-red-400/80 mb-2 line-through">
                  {item.problem}
                </p>
                <p className="text-zinc-300 text-sm leading-relaxed">{item.solution}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Key Features ────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-white/[0.02] border-y border-white/5">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Scale
              </span>
            </h2>
            <p className="mt-4 text-zinc-400 max-w-2xl mx-auto text-lg">
              From ad tracking to checkout optimization, PixEcom covers the entire funnel.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: Target,
                title: 'Ad-to-Sale Tracking',
                description:
                  'Know exactly which Facebook ad, which sellpage, which boost module generated each sale. Full attribution from click to purchase.',
                gradient: 'from-indigo-500 to-blue-600',
              },
              {
                icon: Zap,
                title: 'Lightning-Fast Sellpages',
                description:
                  'Optimized standalone pages that load in under 1 second. No Shopify theme bloat, no slow third-party scripts.',
                gradient: 'from-amber-500 to-orange-600',
              },
              {
                icon: Rocket,
                title: 'Built-in Conversion Boosters',
                description:
                  'Quantity discounts, urgency timers, trust badges, and social proof modules built right into every sellpage.',
                gradient: 'from-emerald-500 to-teal-600',
              },
              {
                icon: BarChart3,
                title: 'Real-time Analytics',
                description:
                  'CR, ROAS, revenue per sellpage, cost per purchase. All your key metrics in one beautiful dashboard, updated in real time.',
                gradient: 'from-violet-500 to-purple-600',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group relative bg-white/[0.03] border border-white/5 rounded-2xl p-8 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 shadow-lg shadow-${feature.gradient.split(' ')[0].replace('from-', '')}/20`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Three Steps to{' '}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                More Sales
              </span>
            </h2>
            <p className="mt-4 text-zinc-400 max-w-2xl mx-auto text-lg">
              Get up and running in minutes, not days.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Create Your Sellpage',
                description:
                  'Build a high-converting product page with our editor. Add images, descriptions, pricing, and conversion boosters in minutes.',
              },
              {
                step: '02',
                title: 'Connect Your Facebook Ads',
                description:
                  'Link your Facebook ad account. PixEcom automatically tracks every click, view, and purchase from each ad.',
              },
              {
                step: '03',
                title: 'Watch the Sales Roll In',
                description:
                  'Monitor your real-time dashboard. See which ads are profitable, kill the losers, and scale the winners.',
              },
            ].map((item, index) => (
              <div key={item.step} className="relative">
                {/* Connector line (hidden on mobile) */}
                {index < 2 && (
                  <div className="hidden md:block absolute top-10 left-[calc(100%+1rem)] w-[calc(100%-2rem)] h-px">
                    <div className="w-full h-px bg-gradient-to-r from-indigo-500/40 to-violet-500/40" />
                  </div>
                )}
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 mb-6">
                    <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Feature Highlights ──────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-white/[0.02] border-y border-white/5">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Why Sellers Choose{' '}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                PixEcom
              </span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-8">
            {[
              'Full Facebook Ads integration with pixel tracking',
              'Standalone sellpages with custom domains',
              'Quantity discounts and urgency timers built-in',
              'Real-time CR, ROAS, and revenue analytics',
              'Stripe and PayPal payment processing',
              'Order management with tracking notifications',
              'SEO-optimized pages with structured data',
              'Email notifications for orders and shipping',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-zinc-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Social Proof ────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-zinc-400 mb-8">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            Trusted by Vietnamese Dropshippers
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            Built by Dropshippers,{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              for Dropshippers
            </span>
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
            PixEcom was born from the frustration of running Facebook ads without knowing which
            ones actually make money. We built the tool we wished existed — and now it is yours.
          </p>
        </div>
      </section>

      {/* ─── CTA Section ─────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-6">
          <div className="relative rounded-3xl overflow-hidden">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />

            <div className="relative px-8 py-16 sm:px-16 sm:py-20 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Ready to Scale Your Dropshipping Business?
              </h2>
              <p className="text-lg text-white/70 max-w-xl mx-auto mb-8">
                Join sellers who finally know which ads make money. Start building sellpages that
                convert and track every sale back to its source.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/login"
                  className="group flex items-center gap-2 bg-white text-indigo-700 font-semibold px-8 py-3.5 rounded-xl text-lg hover:bg-white/90 transition-all shadow-lg shadow-black/20"
                >
                  Start Free Today
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
              <p className="mt-4 text-sm text-white/50">
                No credit card required. Cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-xs">
                P
              </div>
              <span className="text-sm font-semibold tracking-tight">PixEcom</span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <Link href="/login" className="hover:text-zinc-300 transition-colors">
                Login
              </Link>
              <span className="text-zinc-700">|</span>
              <Link href="#" className="hover:text-zinc-300 transition-colors">
                Privacy Policy
              </Link>
              <span className="text-zinc-700">|</span>
              <Link href="#" className="hover:text-zinc-300 transition-colors">
                Terms
              </Link>
            </div>

            {/* Copyright */}
            <p className="text-sm text-zinc-600">
              &copy; 2026 PixEcom by PixelxLab
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
