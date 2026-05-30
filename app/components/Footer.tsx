import Link from "next/link";

export default function Footer() {
  return (
    <footer style={{ background: "#f9fafb", borderTop: "1px solid #e5e7eb" }}>
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* 5-column grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-10 mb-16">
          {/* Col 1: Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="inline-block mb-4">
              <img src="/logo.png" height={40} alt="Ryva" style={{ height: 40 }} />
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              The AI governance platform for teams shipping AI in production.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/ryva-dev/ryva"
                className="text-gray-400 hover:text-gray-700 text-sm transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-gray-700 text-sm transition-colors"
              >
                LinkedIn
              </a>
            </div>
          </div>

          {/* Col 2: Product */}
          <div>
            <p className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-5">Product</p>
            <div className="space-y-3">
              <div><Link href="/product" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Features</Link></div>
              <div><Link href="/product#testing" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Testing</Link></div>
              <div><Link href="/product#observability" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Observability</Link></div>
              <div><Link href="/product#governance" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Governance</Link></div>
              <div><Link href="/pricing" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Pricing</Link></div>
            </div>
          </div>

          {/* Col 3: Enterprise */}
          <div>
            <p className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-5">Enterprise</p>
            <div className="space-y-3">
              <div><Link href="/enterprise#eu-ai-act" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">EU AI Act Compliance</Link></div>
              <div><Link href="/enterprise#colorado" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Colorado AI Act</Link></div>
              <div><Link href="/enterprise#security" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Security</Link></div>
              <div><Link href="/enterprise#audit" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Audit Export</Link></div>
              <div>
                <a
                  href="https://calendly.com/aball-ryvaforge/ryva-demo"
                  className="text-gray-500 hover:text-gray-900 text-sm transition-colors"
                >
                  Contact sales
                </a>
              </div>
            </div>
          </div>

          {/* Col 4: Company */}
          <div>
            <p className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-5">Company</p>
            <div className="space-y-3">
              <div><Link href="/company" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">About</Link></div>
              <div><Link href="/blog" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Blog</Link></div>
              <div><Link href="#" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Careers</Link></div>
              <div><Link href="#" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Press</Link></div>
            </div>
          </div>

          {/* Col 5: Developers */}
          <div>
            <p className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-5">Developers</p>
            <div className="space-y-3">
              <div>
                <a
                  href="https://github.com/ryva-dev/ryva"
                  className="text-gray-500 hover:text-gray-900 text-sm transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              </div>
              <div>
                <a
                  href="https://pypi.org/project/ryva"
                  className="text-gray-500 hover:text-gray-900 text-sm transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PyPI
                </a>
              </div>
              <div><Link href="#" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Documentation</Link></div>
              <div><Link href="#" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Changelog</Link></div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: "1px solid #e5e7eb" }}
        >
          <p className="text-gray-400 text-xs">
            &copy; 2026 Ryva Forge Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-gray-400 hover:text-gray-600 text-xs transition-colors">
              Privacy Policy
            </Link>
            <Link href="#" className="text-gray-400 hover:text-gray-600 text-xs transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
