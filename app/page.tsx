import Link from "next/link";

const features = [
  {
    title: "Structured by default",
    desc: "Every agent, prompt, tool, and pipeline is a versioned YAML file. Dependencies are declared. Everything compiles before it runs, catching broken references before they hit production.",
  },
  {
    title: "Eight test types built in",
    desc: "Schema validation, regression comparison, adversarial probing, memory retention, RAG faithfulness, hallucination detection, fuzz testing, and fine-tune evaluation. All from one CLI command.",
  },
  {
    title: "Full run observability",
    desc: "Every agent run is traced automatically. See the exact prompt sent, the response received, the model used, and the latency in milliseconds. Inspect any run with ryva traces show.",
  },
  {
    title: "Cost intelligence",
    desc: "Track token spend per agent, forecast budget exhaustion at current usage, and surface the cheapest model that still passes all your tests. ryva forecast runs in under a second.",
  },
  {
    title: "Model registry",
    desc: "Register every model your project uses as a versioned entry. Centralize provider credentials, aliases, and capability metadata. One source of truth queried with ryva registry list.",
  },
  {
    title: "Standard benchmarks",
    desc: "Score your agents against four built-in benchmark suites: summarization quality, question answering accuracy, classification F1, and code correctness. Catch regressions before users do.",
  },
];

const testTypes = [
  {
    cmd: "ryva test",
    desc: "Validates output schema, measures latency against configured thresholds, and runs regression assertions against recorded baseline outputs.",
  },
  {
    cmd: "ryva test --fuzz",
    desc: "Fires 15 fuzz categories at your agent: empty strings, unicode, SQL injection patterns, prompt injection payloads, null bytes, HTML tags, and more.",
  },
  {
    cmd: "ryva test --memory",
    desc: "Runs multi-turn conversations and verifies the agent correctly retains and references context from earlier turns.",
  },
  {
    cmd: "ryva test --rag",
    desc: "Tests retrieval pipelines for relevance and faithfulness. Verifies answers are grounded in retrieved documents, not hallucinated.",
  },
  {
    cmd: "ryva test --hallucination",
    desc: "Submits prompts with known facts and detects when the model generates plausible-sounding but factually incorrect claims.",
  },
  {
    cmd: "ryva test --regression",
    desc: "Compares current outputs to a saved baseline. Flags any response that diverges beyond the configured similarity threshold.",
  },
  {
    cmd: "ryva test --adversarial",
    desc: "Probes the agent with crafted inputs: prompt injections, jailbreak attempts, contradictory instructions, and boundary edge cases.",
  },
  {
    cmd: "ryva test --finetune",
    desc: "Runs the same test suite against both the base model and your fine-tuned variant, reporting accuracy delta and regression count.",
  },
];

const stats = [
  { value: "8", label: "Test types built in" },
  { value: "15", label: "Fuzz input categories" },
  { value: "4", label: "Standard benchmarks" },
  { value: "2 min", label: "To first passing test" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-mono font-bold text-gray-900 text-sm tracking-tight">
            ryva
          </Link>
          <div className="flex items-center gap-1">
            <Link href="#features" className="text-gray-500 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">Features</Link>
            <Link href="#testing" className="text-gray-500 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">Testing</Link>
            <Link href="#observability" className="text-gray-500 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">Observability</Link>
            <Link href="#pricing" className="text-gray-500 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">Pricing</Link>
            <Link href="/docs" className="text-gray-500 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">Docs</Link>
            <div className="w-px h-4 bg-gray-200 mx-2" />
            <Link href="https://github.com/ryva-dev/ryva" className="text-gray-500 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">GitHub</Link>
            <Link
              href="https://ryva-dashboard.vercel.app"
              className="ml-2 bg-[#16a34a] text-white text-sm font-medium px-4 py-1.5 rounded-md hover:bg-[#15803d] transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#16a34a] bg-green-50 border border-green-200 rounded-full px-3 py-1 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] inline-block" />
            Open source. MIT licensed. Free to use.
          </div>
          <h1 className="text-5xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-5">
            The engineering framework<br />for agentic AI.
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-xl">
            Structure, test, and observe every AI agent, model, and pipeline you ship.
            Ryva gives AI engineers the rigor that backend teams have had for decades.
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="https://github.com/ryva-dev/ryva"
              className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-md hover:bg-gray-700 transition-colors"
            >
              View on GitHub
            </Link>
            <Link
              href="https://ryva-dashboard.vercel.app"
              className="text-gray-700 text-sm font-medium px-5 py-2.5 rounded-md border border-gray-200 hover:border-gray-400 transition-colors"
            >
              Try Ryva Cloud
            </Link>
          </div>
        </div>

        {/* Hero terminal */}
        <div className="mt-16 border border-gray-200 rounded-xl overflow-hidden shadow-lg">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="font-mono text-xs text-gray-400 ml-3">~/my-project</span>
          </div>
          <div className="bg-[#0d1117] px-6 py-5 font-mono text-sm leading-7">
            <p>
              <span className="text-gray-600">$</span>{" "}
              <span className="text-white">pip install ryva {"&&"} ryva init my-project</span>
            </p>
            <p className="text-[#16a34a] pl-2 mb-3">Project initialized: 1 agent · 1 prompt · 1 tool</p>

            <p>
              <span className="text-gray-600">$</span>{" "}
              <span className="text-white">ryva compile</span>
            </p>
            <p className="text-[#16a34a] pl-2 mb-3">Compiled: 1 agent · 1 pipeline · 0 errors</p>

            <p>
              <span className="text-gray-600">$</span>{" "}
              <span className="text-white">ryva test</span>
            </p>
            <p className="text-[#16a34a] pl-2 mb-3">4/4 tests passed  (schema, latency, regression, adversarial)</p>

            <p>
              <span className="text-gray-600">$</span>{" "}
              <span className="text-white">ryva traces list</span>
            </p>
            <p className="text-gray-500 text-xs pl-2 mb-0.5">  RUN ID      AGENT               STATUS    DURATION</p>
            <p className="text-cyan-400 pl-2">  f87951e4    summarizer_agent    success   2201ms</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-4 divide-x divide-gray-200">
          {stats.map((s) => (
            <div key={s.label} className="px-10 first:pl-0 last:pr-0">
              <p className="text-3xl font-bold text-gray-900 tracking-tight mb-1">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-xl mb-12">
          <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-4">
            Everything your AI stack is missing
          </h2>
          <p className="text-gray-500 text-base leading-relaxed">
            One CLI. All the tooling backend engineers take for granted, purpose-built for LLM-powered systems.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="border border-gray-200 rounded-lg p-6 hover:border-[#16a34a] hover:shadow-sm transition-all duration-150"
            >
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testing */}
      <section id="testing" className="bg-gray-50 border-y border-gray-100 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 gap-16 items-start">
            <div className="pt-1">
              <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-4">
                Test every layer of your AI system
              </h2>
              <p className="text-gray-500 leading-relaxed mb-4">
                Eight test types built in. No configuration required to get started. Each test runs in isolation and reports individually, so failures are easy to trace to their source.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed mb-8">
                Add <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva test</code> to your CI pipeline and it runs automatically on every push. Test results are stored alongside traces so you can jump from a failure directly to the run that caused it.
              </p>
              <div className="border border-gray-200 bg-white rounded-lg overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="font-mono text-xs text-gray-400 ml-2">ryva test --fuzz</span>
                </div>
                <div className="bg-[#0d1117] px-4 py-3 font-mono text-xs leading-6">
                  <p className="text-[#16a34a]">15/15 fuzz tests passed</p>
                  <p className="text-gray-500 mt-1.5">empty, whitespace, very_long, special_chars,</p>
                  <p className="text-gray-500">unicode, sql_injection, prompt_injection,</p>
                  <p className="text-gray-500">null_bytes, newlines, numbers_only, json_input,</p>
                  <p className="text-gray-500">html_tags, repeat_chars, mixed_case,</p>
                  <p className="text-gray-500">negative_number</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {testTypes.map((t) => (
                <div key={t.cmd} className="bg-white border border-gray-200 rounded-lg px-4 py-3.5">
                  <code className="text-[#16a34a] font-mono text-xs font-medium block mb-1.5">{t.cmd}</code>
                  <p className="text-gray-500 text-xs leading-relaxed">{t.desc}</p>
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
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="font-mono text-xs text-gray-400 ml-2">ryva traces show f87951e4</span>
            </div>
            <div className="bg-[#0d1117] px-5 py-4 font-mono text-xs leading-7">
              <p>
                <span className="text-gray-500">Trace:    </span>
                <span className="text-cyan-400">f87951e4</span>
              </p>
              <p>
                <span className="text-gray-500">Agent:    </span>
                <span className="text-white">summarizer_agent</span>
              </p>
              <p>
                <span className="text-gray-500">Model:    </span>
                <span className="text-white">claude-sonnet-4-5 (anthropic)</span>
              </p>
              <p>
                <span className="text-gray-500">Status:   </span>
                <span className="text-[#16a34a]">success</span>
              </p>
              <p>
                <span className="text-gray-500">Duration: </span>
                <span className="text-white">2201ms</span>
              </p>
              <div className="mt-3 border border-blue-900/50 rounded bg-blue-950/20 px-3 py-2.5">
                <p className="text-blue-400 text-xs font-medium mb-1">Step 1 - Prompt</p>
                <p className="text-gray-400 text-xs">{`"You are a precise summarization assistant..."`}</p>
              </div>
              <div className="mt-2 border border-green-900/50 rounded bg-green-950/20 px-3 py-2.5">
                <p className="text-[#16a34a] text-xs font-medium mb-1">Step 2 - Response</p>
                <p className="text-gray-400 text-xs">{`{"summary": "...", "word_count": 8}`}</p>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-4">
              Full visibility on every run
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              Every time an agent runs, Ryva records the full execution trace. The exact prompt sent, the complete response, the model and provider, latency in milliseconds, and token cost. Nothing is summarized or omitted.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              Traces are indexed by run ID, agent name, and timestamp. Inspect any run from the CLI or browse all runs in Ryva Cloud. When a test fails, you can jump directly to the trace that triggered it.
            </p>
            <div className="space-y-4 mb-8">
              <div className="flex items-baseline gap-4">
                <code className="text-[#16a34a] font-mono text-xs shrink-0">ryva traces list</code>
                <span className="text-gray-500 text-sm">List all recent runs, sorted by time</span>
              </div>
              <div className="flex items-baseline gap-4">
                <code className="text-[#16a34a] font-mono text-xs shrink-0">ryva traces show</code>
                <span className="text-gray-500 text-sm">Full step-by-step breakdown of a single run</span>
              </div>
            </div>
            <Link href="https://ryva-dashboard.vercel.app" className="text-[#16a34a] text-sm font-medium hover:underline">
              Browse traces in Ryva Cloud
            </Link>
          </div>
        </div>
      </section>

      {/* Cost Intelligence */}
      <section className="bg-gray-50 border-y border-gray-100 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-4">
                Know what you are spending before it surprises you
              </h2>
              <p className="text-gray-500 leading-relaxed mb-5">
                Ryva tracks token usage per agent run and aggregates it into per-agent cost profiles.{" "}
                <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva forecast</code>{" "}
                projects your monthly spend at current call volume and tells you exactly when you will hit your budget.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed mb-8">
                It also surfaces cheaper model alternatives. If a smaller model passes all your existing tests, Ryva will surface it with the projected savings, so you can switch with confidence.
              </p>
              <div className="space-y-4 mb-8">
                <div className="flex items-baseline gap-4">
                  <code className="text-[#16a34a] font-mono text-xs shrink-0">ryva forecast</code>
                  <span className="text-gray-500 text-sm">Project monthly spend at current usage, by agent</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <code className="text-[#16a34a] font-mono text-xs shrink-0">ryva benchmark</code>
                  <span className="text-gray-500 text-sm">Score agents against four standard evaluation suites</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <code className="text-[#16a34a] font-mono text-xs shrink-0">ryva registry list</code>
                  <span className="text-gray-500 text-sm">View all registered models and provider configurations</span>
                </div>
              </div>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="font-mono text-xs text-gray-400 ml-2">ryva forecast</span>
              </div>
              <div className="bg-[#0d1117] px-5 py-4 font-mono text-xs leading-6">
                <p className="text-gray-500 mb-3">Forecast: my-project  (last 30 days)</p>
                <p className="text-gray-600 mb-1">  AGENT                CALLS    COST/CALL    MONTHLY</p>
                <p>
                  <span className="text-white">  summarizer_agent</span>
                  <span className="text-gray-500">     1,240    </span>
                  <span className="text-yellow-400">$0.0018</span>
                  <span className="text-gray-500">       </span>
                  <span className="text-white">$2.23</span>
                </p>
                <p>
                  <span className="text-white">  classifier_agent</span>
                  <span className="text-gray-500">       890    </span>
                  <span className="text-yellow-400">$0.0009</span>
                  <span className="text-gray-500">       </span>
                  <span className="text-white">$0.80</span>
                </p>
                <p>
                  <span className="text-white">  qa_extractor</span>
                  <span className="text-gray-500">          320    </span>
                  <span className="text-yellow-400">$0.0011</span>
                  <span className="text-gray-500">       </span>
                  <span className="text-white">$0.35</span>
                </p>
                <div className="border-t border-gray-800 mt-3 pt-3">
                  <p className="text-gray-500">
                    Total:{" "}
                    <span className="text-white">$3.38</span>
                    {" "}of{" "}
                    <span className="text-gray-400">$25.00 budget</span>
                    {"  "}
                    <span className="text-[#16a34a]">(13.5% used)</span>
                  </p>
                  <p className="text-gray-500 mt-1">
                    At current pace: budget lasts{" "}
                    <span className="text-white">7.4 months</span>
                  </p>
                </div>
                <div className="mt-3 border border-green-900/40 rounded bg-green-950/10 px-3 py-2">
                  <p className="text-[#16a34a] text-xs mb-1">Cheaper alternatives that pass all tests:</p>
                  <p className="text-gray-400 text-xs">claude-haiku-3    saves $1.21/mo    all 4 tests pass</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-xl mb-12">
          <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-4">
            Start for free. Scale when you need to.
          </h2>
          <p className="text-gray-500 leading-relaxed">
            Ryva is open source and free to use. The CLI runs locally, your traces stay on your machine, and nothing is sent to an external server unless you choose Ryva Cloud.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 max-w-3xl">
          <div className="border border-gray-200 rounded-xl p-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Open Source</p>
            <p className="text-3xl font-bold text-gray-900 tracking-tight mb-1">Free</p>
            <p className="text-gray-500 text-sm mb-8">Forever. No account required.</p>
            <div className="space-y-3 text-sm text-gray-600 mb-8">
              <div>Full CLI: test, compile, dag, benchmark, forecast</div>
              <div>All 8 test types and 15 fuzz categories</div>
              <div>Local trace storage and step-level inspection</div>
              <div>Model registry and cost forecasting</div>
              <div>MIT licensed, self-hosted</div>
            </div>
            <Link
              href="https://github.com/ryva-dev/ryva"
              className="block text-center border border-gray-200 text-gray-700 text-sm font-medium px-5 py-2.5 rounded-md hover:border-gray-400 transition-colors"
            >
              View on GitHub
            </Link>
          </div>
          <div className="border border-[#16a34a] rounded-xl p-8 bg-green-50/30">
            <p className="text-xs font-semibold text-[#16a34a] uppercase tracking-widest mb-4">Ryva Cloud</p>
            <p className="text-3xl font-bold text-gray-900 tracking-tight mb-1">Early access</p>
            <p className="text-gray-500 text-sm mb-8">Hosted traces, team dashboard, CI integrations.</p>
            <div className="space-y-3 text-sm text-gray-600 mb-8">
              <div>Everything in Open Source</div>
              <div>Hosted trace storage with search and filters</div>
              <div>Team collaboration and shared run history</div>
              <div>GitHub Actions integration</div>
              <div>Email support</div>
            </div>
            <Link
              href="https://ryva-dashboard.vercel.app"
              className="block text-center bg-[#16a34a] text-white text-sm font-medium px-5 py-2.5 rounded-md hover:bg-[#15803d] transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* Install */}
      <section className="bg-gray-900 py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
            Up and running in two minutes
          </h2>
          <p className="text-gray-400 leading-relaxed mb-10">
            Open source. No account required. Your first agent test passes before you finish reading this page.
          </p>
          <div className="bg-[#0d1117] border border-gray-800 rounded-xl px-6 py-5 font-mono text-sm text-left mb-8 max-w-md mx-auto">
            <p><span className="text-gray-600">$</span> <span className="text-[#16a34a]">pip install ryva</span></p>
            <p><span className="text-gray-600">$</span> <span className="text-[#16a34a]">ryva init my-project</span></p>
            <p><span className="text-gray-600">$</span> <span className="text-[#16a34a]">ryva test</span></p>
            <p className="text-gray-500 mt-2 text-xs">4/4 tests passed  (schema, latency, regression, adversarial)</p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="https://github.com/ryva-dev/ryva"
              className="bg-white text-gray-900 text-sm font-semibold px-6 py-3 rounded-md hover:bg-gray-100 transition-colors"
            >
              View on GitHub
            </Link>
            <Link
              href="https://ryva-dashboard.vercel.app"
              className="border border-gray-700 text-white text-sm font-medium px-6 py-3 rounded-md hover:border-gray-500 transition-colors"
            >
              Try Ryva Cloud
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-start justify-between">
            <div className="max-w-xs">
              <Link href="/" className="font-mono font-bold text-gray-900 text-sm tracking-tight">ryva</Link>
              <p className="text-gray-400 text-sm mt-3 leading-relaxed">
                The engineering framework for agentic AI. Open source, MIT licensed.
              </p>
            </div>
            <div className="flex items-start gap-16">
              <div>
                <p className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-4">Product</p>
                <div className="space-y-3">
                  <div><Link href="#features" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Features</Link></div>
                  <div><Link href="#testing" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Testing</Link></div>
                  <div><Link href="#observability" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Observability</Link></div>
                  <div><Link href="#pricing" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Pricing</Link></div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-4">Developers</p>
                <div className="space-y-3">
                  <div><Link href="/docs" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Docs</Link></div>
                  <div><Link href="https://github.com/ryva-dev/ryva" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">GitHub</Link></div>
                  <div><Link href="https://ryva-dashboard.vercel.app" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">Cloud</Link></div>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 mt-12 pt-6 flex items-center justify-between">
            <p className="text-gray-400 text-xs">Built for AI engineers.</p>
            <p className="text-gray-400 text-xs">MIT License</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
