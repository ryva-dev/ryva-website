import Link from "next/link";

const features = [
  {
    title: "Structured by default",
    desc: "Every agent, prompt, tool, and pipeline is a versioned YAML file. Dependencies are explicit. Everything compiles before it runs.",
  },
  {
    title: "Eight test types built in",
    desc: "Schema, regression, adversarial, memory, RAG, hallucination detection, fuzz testing — all from a single CLI command.",
  },
  {
    title: "Full run observability",
    desc: "Every run is traced. See the exact prompt sent, response received, model used, latency, and cost. No black boxes.",
  },
  {
    title: "Cost intelligence",
    desc: "Track spend per agent, forecast when you'll hit your budget, and find the cheapest model that passes all your tests.",
  },
  {
    title: "Model registry",
    desc: "Register, version, and query all the models your project uses. One source of truth instead of names scattered across YAML files.",
  },
  {
    title: "Standard benchmarks",
    desc: "Score your model against built-in suites for summarization, QA, classification, and coding. Catch regressions before users do.",
  },
];

const testTypes = [
  { cmd: "ryva test", desc: "Schema, latency, regression" },
  { cmd: "ryva test --adversarial", desc: "Prompt injection, edge cases" },
  { cmd: "ryva test --memory", desc: "Multi-turn context retention" },
  { cmd: "ryva test --rag", desc: "Retrieval + faithfulness" },
  { cmd: "ryva test --hallucination", desc: "Factual grounding checks" },
  { cmd: "ryva test --fuzz", desc: "15 built-in fuzz categories" },
  { cmd: "ryva test --regression", desc: "Baseline comparison" },
  { cmd: "ryva test --finetune", desc: "Base vs fine-tuned model" },
];

const stats = [
  { value: "8", label: "Test types built in" },
  { value: "15", label: "Fuzz input categories" },
  { value: "4", label: "Standard benchmarks" },
  { value: "2min", label: "To first passing test" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="font-mono text-lg font-bold text-gray-900">{`{ryva}`}</span>
          <div className="flex items-center gap-8">
            <Link href="#features" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Features</Link>
            <Link href="#testing" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Testing</Link>
            <Link href="#observability" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Observability</Link>
            <Link href="https://github.com/ryva-dev/ryva" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">GitHub</Link>
            <Link
              href="https://ryva-dashboard.vercel.app"
              className="bg-[#16a34a] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#15803d] transition-colors"
            >
              Get started →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 border border-green-200 bg-green-50 rounded-full px-3 py-1 text-sm text-green-700 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Open source · Free to use
          </div>
          <h1 className="text-6xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-6">
            The engineering<br />framework for<br />
            <span className="text-[#16a34a]">agentic AI.</span>
          </h1>
          <p className="text-xl text-gray-500 leading-relaxed mb-10 max-w-xl">
            Structure, testing, and observability for every AI agent, model, and pipeline you ship. Stop building AI systems in the dark.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="https://github.com/ryva-dev/ryva"
              className="bg-gray-900 text-white font-medium px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
            >
              View on GitHub →
            </Link>
            <Link
              href="https://ryva-dashboard.vercel.app"
              className="border border-gray-200 text-gray-700 font-medium px-6 py-3 rounded-lg hover:border-gray-400 transition-colors"
            >
              Try Ryva Cloud
            </Link>
          </div>
        </div>

        {/* Hero terminal */}
        <div className="mt-20 border border-gray-200 rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span className="text-gray-400 text-xs ml-2 font-mono">~/my-project — zsh</span>
          </div>
          <div className="bg-[#0d1117] p-6 font-mono text-sm leading-8">
            <p><span className="text-gray-500">$</span> <span className="text-white">pip install ryva && ryva init my-project</span></p>
            <p className="text-green-400">✓ Project initialized with 1 agent, 1 prompt, 1 tool</p>
            <p className="mt-2"><span className="text-gray-500">$</span> <span className="text-white">ryva compile</span></p>
            <p className="text-green-400">✓ Compiled successfully — 1 agent · 1 pipeline · 0 errors</p>
            <p className="mt-2"><span className="text-gray-500">$</span> <span className="text-white">ryva test</span></p>
            <p className="text-green-400">✓ 4/4 tests passed</p>
            <p className="mt-2"><span className="text-gray-500">$</span> <span className="text-white">ryva traces list</span></p>
            <p className="text-gray-400">  Run ID   Agent              Status    Duration</p>
            <p className="text-cyan-400">  f87951e4  summarizer_agent   success   2201ms</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-bold text-gray-900 mb-1">{s.value}</p>
              <p className="text-gray-500 text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="mb-14">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything your AI stack is missing</h2>
          <p className="text-gray-500 text-lg max-w-xl">One CLI. Every tool you need to build production AI systems with confidence.</p>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="border border-gray-200 rounded-xl p-6 hover:border-green-300 hover:shadow-sm transition-all">
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center mb-4">
                <div className="w-3 h-3 rounded-full bg-[#16a34a]"></div>
              </div>
              <h3 className="text-gray-900 font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testing */}
      <section id="testing" className="bg-gray-50 border-y border-gray-100 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Test every part of your AI system</h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-6">Eight test types built in. No config needed to get started. Runs in your CI pipeline out of the box.</p>
              <Link href="https://github.com/ryva-dev/ryva" className="text-[#16a34a] font-medium text-sm hover:underline">
                View testing docs →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {testTypes.map((t) => (
                <div key={t.cmd} className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg px-4 py-3">
                  <code className="text-[#16a34a] font-mono text-xs shrink-0 w-44">{t.cmd}</code>
                  <span className="text-gray-500 text-sm">{t.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Observability */}
      <section id="observability" className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid grid-cols-2 gap-16 items-center">
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
              <span className="text-gray-400 text-xs ml-2 font-mono">ryva traces show f87951e4</span>
            </div>
            <div className="bg-[#0d1117] p-5 font-mono text-xs leading-7">
              <p className="text-gray-500">Trace: <span className="text-cyan-400">f87951e4</span></p>
              <p className="text-gray-400">Agent:    <span className="text-white">summarizer_agent</span></p>
              <p className="text-gray-400">Model:    <span className="text-white">claude-sonnet-4-5</span></p>
              <p className="text-gray-400">Status:   <span className="text-green-400">success</span></p>
              <p className="text-gray-400">Duration: <span className="text-white">2201ms</span></p>
              <div className="mt-3 border border-blue-900/40 rounded p-3 bg-blue-950/20">
                <p className="text-blue-400 text-xs mb-1">Step 1 — Prompt</p>
                <p className="text-gray-400 text-xs">You are a precise summarization assistant...</p>
              </div>
              <div className="mt-2 border border-green-900/40 rounded p-3 bg-green-950/20">
                <p className="text-green-400 text-xs mb-1">Step 2 — Response</p>
                <p className="text-gray-400 text-xs">{`{"summary": "Ryva is a testing framework...", "word_count": 8}`}</p>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Full visibility on every run</h2>
            <p className="text-gray-500 text-lg leading-relaxed mb-6">Every time an agent runs, Ryva records the full trace — exact prompt, response, model, latency. Inspect any run with a single command. No more debugging in the dark.</p>
            <code className="block bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-[#16a34a] font-mono text-sm mb-6">
              ryva traces show f87951e4
            </code>
            <Link href="https://ryva-dashboard.vercel.app" className="text-[#16a34a] font-medium text-sm hover:underline">
              View all traces in Ryva Cloud →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Start building AI systems you can trust</h2>
          <p className="text-gray-400 text-lg mb-10">Open source, free to use, no account required. Get your first agent tested in under 2 minutes.</p>
          <div className="bg-[#0d1117] border border-gray-700 rounded-xl p-5 font-mono text-sm text-left mb-8 max-w-md mx-auto">
            <p><span className="text-gray-500">$</span> <span className="text-green-400">pip install ryva</span></p>
            <p><span className="text-gray-500">$</span> <span className="text-green-400">ryva init my-project</span></p>
            <p><span className="text-gray-500">$</span> <span className="text-green-400">ryva test</span></p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <Link href="https://github.com/ryva-dev/ryva" className="bg-white text-gray-900 font-semibold px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors">
              View on GitHub →
            </Link>
            <Link href="https://ryva-dashboard.vercel.app" className="border border-gray-600 text-white px-6 py-3 rounded-lg hover:border-gray-400 transition-colors">
              Try Ryva Cloud
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <span className="font-mono font-bold text-gray-900">{`{ryva}`}</span>
          <p className="text-gray-400 text-sm">Built for AI engineers tired of building in the dark.</p>
          <div className="flex items-center gap-6">
            <Link href="https://github.com/ryva-dev/ryva" className="text-gray-400 hover:text-gray-900 text-sm transition-colors">GitHub</Link>
            <Link href="https://ryva-dashboard.vercel.app" className="text-gray-400 hover:text-gray-900 text-sm transition-colors">Cloud</Link>
            <Link href="https://ryva-dashboard.vercel.app/docs" className="text-gray-400 hover:text-gray-900 text-sm transition-colors">Docs</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}