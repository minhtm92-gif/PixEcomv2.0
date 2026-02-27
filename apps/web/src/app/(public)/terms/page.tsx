import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | PixEcom',
  description:
    'Read the Terms of Service for the PixEcom sellpage builder platform by PixelxLab.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* ─── Navigation ──────────────────────────────────────────────────── */}
      <nav className="border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-sm">
              P
            </div>
            <span className="text-lg font-bold tracking-tight">PixEcom</span>
          </Link>
          <Link
            href="/login"
            className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* ─── Content ─────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-zinc-500 mb-12">Last updated: February 2026</p>

        <div className="space-y-10 text-zinc-300 text-sm leading-relaxed">
          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the PixEcom platform operated by PixelxLab (&quot;we,&quot;
              &quot;us,&quot; or &quot;our&quot;) at pixecom.pixelxlab.com, you agree to be bound by
              these Terms of Service. If you do not agree to these terms, you may not use the
              platform.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              PixEcom is a sellpage builder platform designed for e-commerce sellers. The platform
              enables you to create product sellpages, connect Facebook ad accounts for performance
              tracking, process payments via Stripe and PayPal, manage orders, and view real-time
              analytics including conversion rates and ROAS.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Account Responsibilities</h2>
            <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must notify us immediately of any unauthorized access to your account.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must be at least 18 years old to use the platform.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p className="mb-3">You agree not to use PixEcom to:</p>
            <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
              <li>Sell illegal, counterfeit, or prohibited products.</li>
              <li>Engage in fraud, deception, or misleading advertising.</li>
              <li>Violate any applicable laws, regulations, or third-party rights.</li>
              <li>Distribute malware, spam, or harmful content through sellpages.</li>
              <li>Attempt to gain unauthorized access to the platform or other users&apos; accounts.</li>
              <li>Manipulate analytics data or engage in click fraud.</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these terms without
              prior notice.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Intellectual Property</h2>
            <p>
              The PixEcom platform, including its design, code, features, and branding, is owned by
              PixelxLab and protected by intellectual property laws. You retain ownership of the
              content you upload (product images, descriptions, etc.). By using the platform, you
              grant us a limited license to display and process your content solely to provide the
              service.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Payment Terms</h2>
            <p>
              Payments for orders placed on your sellpages are processed by third-party payment
              providers (Stripe and PayPal). You are responsible for any fees charged by these
              providers. PixEcom may charge platform fees as described in your plan. All fees are
              non-refundable unless otherwise stated. You are responsible for applicable taxes in your
              jurisdiction.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, PixEcom and PixelxLab shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages arising from your
              use of the platform. This includes but is not limited to loss of revenue, data, or
              business opportunities. Our total liability shall not exceed the amount you paid to us in
              the 12 months preceding the claim.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Disclaimer of Warranties</h2>
            <p>
              The platform is provided &quot;as is&quot; and &quot;as available&quot; without
              warranties of any kind, either express or implied. We do not guarantee that the platform
              will be uninterrupted, error-free, or free of harmful components. We make no warranties
              regarding the accuracy of analytics data or ad tracking results.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Termination</h2>
            <p>
              You may terminate your account at any time by contacting us or using the account
              deletion feature. We may suspend or terminate your account if you violate these terms or
              for any reason with reasonable notice. Upon termination, your right to use the platform
              ceases immediately. We may retain certain data as required by law.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Governing Law</h2>
            <p>
              These Terms of Service are governed by and construed in accordance with the laws of the
              United States. Any disputes arising from these terms shall be resolved in the courts of
              the United States. You agree to submit to the personal jurisdiction of such courts.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms of Service at any time. We will notify you of
              material changes by posting the updated terms on this page and updating the &quot;Last
              updated&quot; date. Continued use of the platform after changes constitutes acceptance of
              the revised terms.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Contact Us</h2>
            <p>
              If you have questions about these Terms of Service, contact us at:{' '}
              <a href="mailto:support@pixelxlab.com" className="text-indigo-400 hover:underline">
                support@pixelxlab.com
              </a>
            </p>
          </section>
        </div>
      </main>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto max-w-3xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-zinc-300">
              Terms of Service
            </Link>
            <Link href="/data-deletion" className="hover:text-zinc-300 transition-colors">
              Data Deletion
            </Link>
          </div>
          <p className="text-sm text-zinc-600">&copy; 2026 PixEcom by PixelxLab</p>
        </div>
      </footer>
    </div>
  );
}
