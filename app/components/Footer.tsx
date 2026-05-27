import Link from "next/link";

export default function Footer() {
  return (
    <footer style={{ background: "#fafafa", borderTop: "1px solid #f0f0f0" }}>
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
          <div>
            <p className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-5">Product</p>
            <div className="space-y-3">
              <div><Link href="/product#features" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Features</Link></div>
              <div><Link href="/product#testing" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Testing</Link></div>
              <div><Link href="/product#observability" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Observability</Link></div>
              <div><Link href="/product#governance" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Governance</Link></div>
              <div><Link href="/pricing" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Pricing</Link></div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-5">Enterprise</p>
            <div className="space-y-3">
              <div><Link href="/enterprise#security" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Security</Link></div>
              <div><Link href="/enterprise#compliance" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Compliance</Link></div>
              <div><Link href="/enterprise#eu-ai-act" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">EU AI Act</Link></div>
              <div><Link href="mailto:sales@ryvaforge.com" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Contact sales</Link></div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-5">Company</p>
            <div className="space-y-3">
              <div><Link href="/company" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">About</Link></div>
              <div><Link href="/blog" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Blog</Link></div>
              <div><Link href="#" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Careers</Link></div>
              <div><Link href="#" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Press</Link></div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-5">Developers</p>
            <div className="space-y-3">
              <div><Link href="https://github.com/ryva-dev/ryva" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">GitHub</Link></div>
              <div><Link href="#" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Docs</Link></div>
              <div><Link href="#" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">PyPI</Link></div>
              <div><Link href="#" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Changelog</Link></div>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderTop: "1px solid #f0f0f0" }}>
          <Link
            href="/"
            className="font-mono font-bold text-[#16a34a]"
            style={{ fontSize: 16, fontFamily: "var(--font-geist-mono)" }}
          >
            {`{ryva}`}
          </Link>
          <p className="text-gray-400 text-xs">© 2026 Ryva Forge Inc.</p>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-gray-400 hover:text-gray-600 text-xs transition-colors">Privacy</Link>
            <Link href="#" className="text-gray-400 hover:text-gray-600 text-xs transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
