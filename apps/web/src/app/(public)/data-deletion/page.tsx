import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Deletion | PixEcom',
  description:
    'Learn how to request deletion of your data from the PixEcom platform by PixelxLab.',
};

export default function DataDeletionPage() {
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
          Data Deletion
        </h1>
        <p className="text-sm text-zinc-500 mb-12">Last updated: February 2026</p>

        <div className="space-y-10 text-zinc-300 text-sm leading-relaxed">
          {/* Intro */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Your Right to Data Deletion</h2>
            <p>
              At PixEcom by PixelxLab, we respect your right to control your personal data. You may
              request the deletion of your account and associated data at any time. This page explains
              how to submit a deletion request and what happens to your data.
            </p>
          </section>

          {/* How to request */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">How to Request Data Deletion</h2>
            <p className="mb-4">You can request deletion of your data using either of these methods:</p>

            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-white">Option 1: Through Your Account</h3>
              <ol className="list-decimal list-inside space-y-2 text-zinc-400">
                <li>
                  Log into your PixEcom account at{' '}
                  <span className="text-zinc-300">pixecom.pixelxlab.com</span>
                </li>
                <li>
                  Navigate to <span className="text-zinc-300">Settings &gt; Account</span>
                </li>
                <li>
                  Click <span className="text-zinc-300">&quot;Delete My Account&quot;</span>
                </li>
                <li>Confirm the deletion when prompted</li>
              </ol>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 space-y-4 mt-4">
              <h3 className="text-base font-semibold text-white">Option 2: Via Email</h3>
              <p className="text-zinc-400">
                Send an email to{' '}
                <a href="mailto:support@pixelxlab.com" className="text-indigo-400 hover:underline">
                  support@pixelxlab.com
                </a>{' '}
                with the subject line <span className="text-zinc-300">&quot;Data Deletion Request&quot;</span>.
                Include the email address associated with your PixEcom account so we can locate and
                process your request.
              </p>
            </div>
          </section>

          {/* What gets deleted */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">What Data Gets Deleted</h2>
            <p className="mb-3">Upon processing your request, the following data will be permanently deleted:</p>
            <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
              <li>Your account profile and login credentials</li>
              <li>Sellpage content, product listings, and uploaded media</li>
              <li>Facebook ad campaign data and connected account information</li>
              <li>Analytics and performance reports</li>
              <li>Customer lists and contact information</li>
              <li>Preferences and platform settings</li>
            </ul>
          </section>

          {/* What is retained */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">What Data Is Retained</h2>
            <p className="mb-3">
              Certain data is retained for legal and regulatory compliance, even after account
              deletion:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
              <li>
                <span className="text-zinc-300 font-medium">Order and transaction records</span> —
                retained for 7 years as required by tax and financial regulations.
              </li>
              <li>
                <span className="text-zinc-300 font-medium">Payment processing records</span> —
                retained by our payment partners (Stripe, PayPal) under their own policies.
              </li>
              <li>
                <span className="text-zinc-300 font-medium">Legal compliance records</span> — any data
                required to be retained by applicable law.
              </li>
            </ul>
            <p className="mt-3 text-zinc-500">
              Retained data is anonymized where possible and is only used for legal compliance
              purposes.
            </p>
          </section>

          {/* Timeline */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Processing Timeline</h2>
            <p>
              Data deletion requests are processed within <span className="text-white font-medium">30 days</span> of
              receipt. You will receive an email confirmation once your data has been deleted. During the
              processing period, your account will be deactivated and inaccessible.
            </p>
          </section>

          {/* Facebook */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Facebook Login Users</h2>
            <p>
              If you signed up using Facebook Login, you can also manage your data through
              Facebook&apos;s settings. Go to your Facebook{' '}
              <span className="text-zinc-300">Settings &gt; Apps and Websites</span>, find PixEcom,
              and remove the app. This will trigger a data deletion callback to our servers.
              Alternatively, use the methods described above for a complete deletion.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Contact Us</h2>
            <p>
              For questions about data deletion or to check the status of your request, contact us
              at:{' '}
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
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">
              Terms of Service
            </Link>
            <Link href="/data-deletion" className="text-zinc-300">
              Data Deletion
            </Link>
          </div>
          <p className="text-sm text-zinc-600">&copy; 2026 PixEcom by PixelxLab</p>
        </div>
      </footer>
    </div>
  );
}
