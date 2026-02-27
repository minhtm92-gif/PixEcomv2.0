import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | PixEcom',
  description:
    'Learn how PixEcom by PixelxLab collects, uses, and protects your personal data.',
};

export default function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p className="text-sm text-zinc-500 mb-12">Last updated: February 2026</p>

        <div className="space-y-10 text-zinc-300 text-sm leading-relaxed">
          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              PixEcom by PixelxLab (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the
              PixEcom platform at pixecom.pixelxlab.com. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our service.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following categories of information:</p>
            <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
              <li>
                <span className="text-zinc-300 font-medium">Account Information</span> — name, email
                address, password (hashed), and business details you provide during registration.
              </li>
              <li>
                <span className="text-zinc-300 font-medium">Usage Data</span> — pages visited, features
                used, browser type, IP address, and device information collected automatically.
              </li>
              <li>
                <span className="text-zinc-300 font-medium">Ad Campaign Data</span> — Facebook ad
                performance metrics, ad spend, click and conversion data synced from your connected ad
                accounts.
              </li>
              <li>
                <span className="text-zinc-300 font-medium">Transaction Data</span> — order details,
                payment amounts, and shipping information processed through your sellpages.
              </li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
              <li>Provide, operate, and maintain the PixEcom platform and its features.</li>
              <li>Process transactions and send related notifications (order confirmations, shipping updates).</li>
              <li>Generate analytics and reports to help you optimize your ad campaigns and sellpages.</li>
              <li>Improve our platform, develop new features, and enhance user experience.</li>
              <li>Communicate with you about updates, support, and promotional offers (with opt-out).</li>
              <li>Detect and prevent fraud, abuse, and security incidents.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Sharing</h2>
            <p className="mb-3">
              We do not sell your personal data. We may share information with the following third
              parties solely to provide our services:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
              <li>
                <span className="text-zinc-300 font-medium">Payment Processors</span> — Stripe and
                PayPal, to process payments on your sellpages.
              </li>
              <li>
                <span className="text-zinc-300 font-medium">Cloud Infrastructure</span> — hosting and
                storage providers to operate the platform.
              </li>
              <li>
                <span className="text-zinc-300 font-medium">Facebook/Meta</span> — when you connect your
                ad account, data flows between PixEcom and Meta as authorized by you.
              </li>
              <li>
                <span className="text-zinc-300 font-medium">Legal Compliance</span> — we may disclose
                data when required by law or to protect our rights.
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to maintain your session, remember preferences,
              and collect usage analytics. Third-party services such as Facebook Pixel may set cookies
              on your sellpages to track ad conversions. You can manage cookie preferences through your
              browser settings.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. Usage and analytics
              data is retained for up to 24 months. Transaction records are retained for 7 years to
              comply with tax and legal obligations. When you delete your account, personal data is
              removed within 30 days, except where retention is legally required.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and associated data.</li>
              <li>Export your data in a portable format.</li>
              <li>Withdraw consent for optional data processing at any time.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:support@pixelxlab.com" className="text-indigo-400 hover:underline">
                support@pixelxlab.com
              </a>
              .
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Security</h2>
            <p>
              We implement industry-standard security measures including encryption in transit (TLS),
              hashed passwords, and secure server infrastructure. However, no method of transmission
              over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by posting the updated policy on this page and updating the &quot;Last
              updated&quot; date. Your continued use of the platform after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, contact us at:{' '}
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
            <Link href="/privacy" className="text-zinc-300">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">
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
