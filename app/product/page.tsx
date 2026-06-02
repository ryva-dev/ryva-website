import Link from "next/link";

function TermBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div
        className="px-4 py-2.5 flex items-center gap-1.5"
        style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
        <span
          className="text-gray-400 text-xs ml-2"
          style={{ fontFamily: "var(--font-geist-mono)" }}
        >
          {title}
        </span>
      </div>
      <div
        className="bg-[#0d1117] p-5"
        style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, lineHeight: "1.85" }}
      >
        {children}
      </div>
    </div>
  );
}

const ARTICLES = [
  { id: "Article 9",  req: "Risk management",    covered: true },
  { id: "Article 10", req: "Data governance",     covered: true },
  { id: "Article 12", req: "Record-keeping",      covered: true },
  { id: "Article 13", req: "Transparency",        covered: true },
  { id: "Article 14", req: "Human oversight",     covered: true },
  { id: "Article 15", req: "Accuracy/robustness", covered: true },
];

export default function ProductPage() {
  return (
    <div className="bg-white text-gray-900">

      {/* Hero */}
      <section className="text-center px-6 py-24" style={{ borderBottom: "1px solid #f0f0f0" }}>
        <div className="max-w-3xl mx-auto">
          <h1
            className="font-bold text-gray-900 tracking-tight mb-5"
            style={{ fontSize: "clamp(36px,5vw,56px)", lineHeight: 1.1 }}
          >
            Every feature your AI governance stack needs.
          </h1>
          <p
            className="text-gray-500 mx-auto mb-8"
            style={{ fontSize: 18, maxWidth: 580, lineHeight: 1.65 }}
          >
            One platform. Test runner, lineage engine, governance reporter, model cards, cost forecasting, and audit export. All from a single CLI.
          </p>
          <a
            href="/demo"
            className="bg-[#16a34a] text-white px-6 py-3 rounded-full font-medium hover:bg-[#15803d] transition-colors text-sm inline-block"
          >
            Book a demo
          </a>
        </div>
      </section>

      {/* 1. Testing suite */}
      <section id="testing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: "clamp(24px,3vw,36px)" }}
            >
              Nine test types. One CLI.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              Add <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva test --all</code> to your CI pipeline. All nine test types run on every push and results are stored alongside your lineage records.
            </p>
            <ul className="space-y-2 mb-6">
              {[
                "Schema validation",
                "Regression comparison",
                "Adversarial probing",
                "Memory retention",
                "RAG faithfulness",
                "Hallucination detection",
                "Fuzz testing (15 categories)",
                "Fine-tune evaluation",
                "Business alignment",
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="w-4 h-4 rounded-full border-2 border-[#16a34a] flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <TermBlock title="ryva test --all">
            <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva test --all</span></p>
            <p style={{ color: "#8b949e" }} className="mt-1">Running all 9 test types...</p>
            <div className="mt-2 space-y-0.5">
              {[
                ["schema",         "PASS"],
                ["regression",     "PASS"],
                ["adversarial",    "PASS"],
                ["memory",         "PASS"],
                ["rag",            "PASS"],
                ["hallucination",  "PASS"],
                ["fuzz",           "PASS"],
                ["finetune",       "PASS"],
                ["alignment",      "PASS"],
              ].map(([name, status]) => (
                <div key={name} className="flex gap-4">
                  <span style={{ color: "#8b949e" }} className="w-28 shrink-0">{name}</span>
                  <span style={{ color: "#16a34a" }}>{status}</span>
                </div>
              ))}
            </div>
            <p style={{ color: "#16a34a" }} className="mt-3 font-medium">9/9 test types passed</p>
          </TermBlock>
        </div>
      </section>

      {/* 2. Lineage engine */}
      <section id="lineage" className="py-24 px-6" style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <TermBlock title="ryva lineage show f87951e4">
            <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva lineage show f87951e4</span></p>
            <div className="mt-1">
              <p><span style={{ color: "#8b949e" }}>Run:         </span><span style={{ color: "#67e8f9" }}>f87951e4</span></p>
              <p><span style={{ color: "#8b949e" }}>Agent:       </span><span style={{ color: "#ffffff" }}>intake_agent</span></p>
              <p><span style={{ color: "#8b949e" }}>Parent:      </span><span style={{ color: "#9ca3af" }}>3c5d9a2b</span></p>
              <p><span style={{ color: "#8b949e" }}>Input hash:  </span><span style={{ color: "#d1d5db" }}>sha256:8f3a9c2d...e4b7f1a8</span></p>
              <p><span style={{ color: "#8b949e" }}>Prompt:      </span><span style={{ color: "#d1d5db" }}>v2.1 (sha256:7a2b5e9f)</span></p>
              <p><span style={{ color: "#8b949e" }}>RAG chunks:  </span><span style={{ color: "#d1d5db" }}>3 docs [a1b2, e5f6, c9d0]</span></p>
              <p><span style={{ color: "#8b949e" }}>Tool calls:  </span><span style={{ color: "#d1d5db" }}>validate_schema, fetch_context</span></p>
              <p><span style={{ color: "#8b949e" }}>Output hash: </span><span style={{ color: "#d1d5db" }}>sha256:2d8e1c7b...f5a9b3c6</span></p>
              <p><span style={{ color: "#8b949e" }}>Tokens:      </span><span style={{ color: "#d1d5db" }}>1,820 in + 287 out</span></p>
              <p><span style={{ color: "#8b949e" }}>Cost:        </span><span style={{ color: "#d1d5db" }}>$0.0018</span></p>
            </div>
            <p style={{ color: "#16a34a" }} className="mt-2">Tamper-evident signature verified</p>
          </TermBlock>
          <div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: "clamp(24px,3vw,36px)" }}
            >
              Full lineage on every agent run.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              Every agent run records the complete chain: input, prompt version, retrieval sources, tool calls, output, cost, and tokens. Records are signed with tamper-evident HMAC signatures.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              Run <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva lineage verify</code> to prove data integrity to auditors. Parent run IDs link multi-step pipelines into a full execution graph.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Business alignment */}
      <section id="alignment" className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: "clamp(24px,3vw,36px)" }}
            >
              Alignment rules that run automatically.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              Declare alignment rules in your agent config. Seven rule types auto-run on every <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva run</code> and fail the run if any rule is violated.
            </p>
            <ul className="space-y-2 mb-6">
              {[
                "Tone enforcement",
                "Schema constraints",
                "Length bounds",
                "Compliance flags",
                "Brand guidelines",
                "Toxicity filtering",
                "Factual grounding",
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="w-4 h-4 rounded-full border-2 border-[#16a34a] flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          {/* ryva.toml code block */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div
              className="px-4 py-2.5 flex items-center gap-1.5"
              style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span
                className="text-gray-400 text-xs ml-2"
                style={{ fontFamily: "var(--font-geist-mono)" }}
              >
                ryva.toml
              </span>
            </div>
            <div
              className="bg-[#0d1117] p-5"
              style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, lineHeight: "1.85" }}
            >
              <p style={{ color: "#8b949e" }}>[agent.intake_agent.alignment]</p>
              <p className="mt-2">
                <span style={{ color: "#79c0ff" }}>tone</span>
                <span style={{ color: "#8b949e" }}> = </span>
                <span style={{ color: "#a5f3fc" }}>&quot;professional&quot;</span>
              </p>
              <p>
                <span style={{ color: "#79c0ff" }}>max_tokens</span>
                <span style={{ color: "#8b949e" }}> = </span>
                <span style={{ color: "#fbbf24" }}>500</span>
              </p>
              <p>
                <span style={{ color: "#79c0ff" }}>schema</span>
                <span style={{ color: "#8b949e" }}> = </span>
                <span style={{ color: "#a5f3fc" }}>&quot;schemas/intake_output.json&quot;</span>
              </p>
              <p>
                <span style={{ color: "#79c0ff" }}>compliance_flags</span>
                <span style={{ color: "#8b949e" }}> = </span>
                <span style={{ color: "#a5f3fc" }}>[&quot;no_pii&quot;, &quot;no_competitor_refs&quot;]</span>
              </p>
              <p>
                <span style={{ color: "#79c0ff" }}>factual_grounding</span>
                <span style={{ color: "#8b949e" }}> = </span>
                <span style={{ color: "#fbbf24" }}>true</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Governance */}
      <section id="governance" className="py-24 px-6" style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <TermBlock title="ryva governance report">
            <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva governance report</span></p>
            <p style={{ color: "#8b949e" }} className="mt-1">EU AI Act Compliance Report</p>
            <div className="mt-2 space-y-0.5">
              {ARTICLES.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <span style={{ color: "#8b949e" }} className="w-24 shrink-0">{a.id}</span>
                  <span style={{ color: "#d1d5db" }} className="flex-1">{a.req}</span>
                  <span style={{ color: "#16a34a" }}>PASS</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-800 mt-3 pt-3">
              <p>
                <span style={{ color: "#8b949e" }}>Overall score: </span>
                <span style={{ color: "#ffffff" }}>0.87</span>
                <span style={{ color: "#16a34a" }}> — COMPLIANT</span>
              </p>
            </div>
            <p style={{ color: "#16a34a" }} className="mt-2">Report written to target/governance_report.json</p>
          </TermBlock>
          <div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: "clamp(24px,3vw,36px)" }}
            >
              EU AI Act and Colorado AI Act compliance, built in.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              Continuous compliance documentation, not annual. Run <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva governance report</code> at any time to get a machine-readable compliance score for Articles 9 through 15.
            </p>
            <div className="space-y-2">
              {ARTICLES.map((a) => (
                <div key={a.id} className="flex items-center gap-3 text-sm">
                  <span className="text-[#16a34a] text-base">&#10003;</span>
                  <span className="font-medium text-gray-700">{a.id}</span>
                  <span className="text-gray-500">{a.req}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Model cards */}
      <section id="model-cards" className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: "clamp(24px,3vw,36px)" }}
            >
              Model cards that meet regulatory requirements.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              Auto-generated model cards meet EU AI Act Article 13 transparency requirements. One command generates a structured JSON card covering intended purpose, training data provenance, known limitations, and risk classification.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              Each model card is versioned alongside your lineage records and can be exported as part of the full audit package.
            </p>
          </div>
          <TermBlock title="ryva modelcard generate --agent intake_agent">
            <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva modelcard generate --agent intake_agent</span></p>
            <p style={{ color: "#8b949e" }} className="mt-1">Generating model card for intake_agent...</p>
            <div className="mt-2">
              <p><span style={{ color: "#8b949e" }}>Agent:            </span><span style={{ color: "#ffffff" }}>intake_agent</span></p>
              <p><span style={{ color: "#8b949e" }}>Base model:       </span><span style={{ color: "#ffffff" }}>claude-sonnet-4-5</span></p>
              <p><span style={{ color: "#8b949e" }}>Purpose:          </span><span style={{ color: "#ffffff" }}>intake classification</span></p>
              <p><span style={{ color: "#8b949e" }}>Risk class:       </span><span style={{ color: "#fbbf24" }}>MEDIUM</span></p>
              <p><span style={{ color: "#8b949e" }}>Article 13:       </span><span style={{ color: "#16a34a" }}>PASS</span></p>
              <p><span style={{ color: "#8b949e" }}>Limitations:      </span><span style={{ color: "#d1d5db" }}>3 documented</span></p>
            </div>
            <p style={{ color: "#16a34a" }} className="mt-2">Written: model_cards/intake_agent.json</p>
          </TermBlock>
        </div>
      </section>

      {/* 6. Audit export */}
      <section id="audit" className="py-24 px-6" style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <TermBlock title="ryva audit export">
            <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva audit export</span></p>
            <p style={{ color: "#16a34a" }} className="mt-1">✓ Audit package ready</p>
            <div className="mt-3" style={{ color: "#8b949e" }}>
              <p>ryva_audit_myproject_20260529.zip</p>
              <p className="pl-2">├── README.md</p>
              <p className="pl-2">├── governance/</p>
              <p className="pl-4">│   ├── governance_report.json</p>
              <p className="pl-4">│   └── governance_report.md</p>
              <p className="pl-2">├── model_cards/</p>
              <p className="pl-4">│   └── intake_agent_model_card.json</p>
              <p className="pl-2">├── lineage/</p>
              <p className="pl-4">│   └── (142 records, all verified)</p>
              <p className="pl-2">├── compliance/</p>
              <p className="pl-4">│   ├── eu_ai_act_checklist.md</p>
              <p className="pl-4">│   └── colorado_ai_act_checklist.md</p>
              <p className="pl-2">└── PACKAGE_MANIFEST.json</p>
            </div>
          </TermBlock>
          <div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: "clamp(24px,3vw,36px)" }}
            >
              Complete audit package in one command.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              One command generates a complete audit zip containing your governance report, model cards, lineage records, and compliance checklists. Hand it directly to your legal team.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              The package includes both EU AI Act and Colorado AI Act checklists, all verified lineage records, and a machine-readable manifest your regulators can process programmatically.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Observability */}
      <section id="observability" className="py-24 px-6" style={{ scrollMarginTop: 60 }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: "clamp(24px,3vw,36px)" }}
            >
              Traces, cost, and forecasting in one view.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              Every agent run is traced automatically. Inspect any run with <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva traces show</code> to see the exact prompt, response, model, latency, cost, and PII masking status.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              30-day cost forecasting per agent with budget alerts. Know what your AI costs before your cloud bill arrives.
            </p>
          </div>
          <TermBlock title="ryva traces show f87951e4">
            <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva traces show f87951e4</span></p>
            <div className="mt-1">
              <p><span style={{ color: "#8b949e" }}>Trace:    </span><span style={{ color: "#67e8f9" }}>f87951e4</span></p>
              <p><span style={{ color: "#8b949e" }}>Agent:    </span><span style={{ color: "#ffffff" }}>intake_agent</span></p>
              <p><span style={{ color: "#8b949e" }}>Model:    </span><span style={{ color: "#ffffff" }}>claude-sonnet-4-5</span></p>
              <p><span style={{ color: "#8b949e" }}>Status:   </span><span style={{ color: "#16a34a" }}>success</span></p>
              <p><span style={{ color: "#8b949e" }}>Duration: </span><span style={{ color: "#ffffff" }}>2201ms</span></p>
              <p><span style={{ color: "#8b949e" }}>Tokens:   </span><span style={{ color: "#ffffff" }}>1,820 in + 287 out</span></p>
              <p><span style={{ color: "#8b949e" }}>Cost:     </span><span style={{ color: "#ffffff" }}>$0.0018</span></p>
              <p><span style={{ color: "#8b949e" }}>PII:      </span><span style={{ color: "#fbbf24" }}>masked (3 fields)</span></p>
            </div>
          </TermBlock>
        </div>
      </section>

      {/* 8. Cost Intelligence */}
      <section id="cost" className="py-24 px-6" style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <TermBlock title="ryva registry list">
            <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva registry list</span></p>
            <div className="mt-1">
              <p style={{ color: "#6b7280" }} className="mb-1">NAME               VER    PROVIDER    ALIAS</p>
              <p><span style={{ color: "#ffffff" }}>claude-sonnet-4-5  </span><span style={{ color: "#8b949e" }}>4.5    anthropic   claude-main   </span><span style={{ color: "#16a34a" }}>active</span></p>
              <p><span style={{ color: "#ffffff" }}>claude-haiku-3     </span><span style={{ color: "#8b949e" }}>3.0    anthropic   claude-fast   </span><span style={{ color: "#16a34a" }}>active</span></p>
              <p><span style={{ color: "#ffffff" }}>gpt-4o             </span><span style={{ color: "#8b949e" }}>2024   openai      gpt-main      </span><span style={{ color: "#16a34a" }}>active</span></p>
              <p><span style={{ color: "#ffffff" }}>gemini-1.5-pro     </span><span style={{ color: "#8b949e" }}>1.5    google      gemini-main   </span><span style={{ color: "#16a34a" }}>active</span></p>
              <p><span style={{ color: "#ffffff" }}>llama3.1:70b       </span><span style={{ color: "#8b949e" }}>70b    ollama      local-large   </span><span style={{ color: "#16a34a" }}>active</span></p>
            </div>
          </TermBlock>
          <div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: "clamp(24px,3vw,36px)" }}
            >
              Versioned model registry with full metadata.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              Register every model your project uses as a versioned entry. Centralize provider credentials, aliases, and capability metadata. One source of truth queried with <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva registry list</code>.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              Models tagged with aliases like <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">prod</code> or <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">canary</code> let you switch models in one place. Versioned entries mean you always know which model ran on which date.
            </p>
          </div>
        </div>
      </section>

      {/* 9. Plugin system */}
      <section id="plugins" className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: "clamp(24px,3vw,36px)" }}
            >
              Extend Ryva with custom plugins.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              Ryva ships with nine test types and four providers. When those are not enough, the plugin system lets you add your own without forking the core.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              Write a custom test type by implementing the <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">TestRunner</code> interface and registering it in your project config. Custom providers implement <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ModelProvider</code> for internal models or private endpoints.
            </p>
          </div>
          {/* Python code block */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div
              className="px-4 py-2.5 flex items-center gap-1.5"
              style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span
                className="text-gray-400 text-xs ml-2"
                style={{ fontFamily: "var(--font-geist-mono)" }}
              >
                custom_provider.py
              </span>
            </div>
            <div
              className="bg-[#0d1117] p-5"
              style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, lineHeight: "1.85" }}
            >
              <p><span style={{ color: "#ff7b72" }}>from</span><span style={{ color: "#c9d1d9" }}> ryva.providers </span><span style={{ color: "#ff7b72" }}>import</span><span style={{ color: "#c9d1d9" }}> ModelProvider</span></p>
              <p className="mt-2"><span style={{ color: "#ff7b72" }}>class</span><span style={{ color: "#f0e68c" }}> MyProvider</span><span style={{ color: "#c9d1d9" }}>(ModelProvider):</span></p>
              <p className="pl-4"><span style={{ color: "#8b949e" }}>"""Custom internal LLM endpoint."""</span></p>
              <p className="mt-1 pl-4">
                <span style={{ color: "#ff7b72" }}>def</span>
                <span style={{ color: "#d2a8ff" }}> complete</span>
                <span style={{ color: "#c9d1d9" }}>(</span>
                <span style={{ color: "#ffa657" }}>self</span>
                <span style={{ color: "#c9d1d9" }}>, prompt: </span>
                <span style={{ color: "#79c0ff" }}>str</span>
                <span style={{ color: "#c9d1d9" }}>) -&gt; </span>
                <span style={{ color: "#79c0ff" }}>str</span>
                <span style={{ color: "#c9d1d9" }}>:</span>
              </p>
              <p className="pl-8"><span style={{ color: "#8b949e" }}># call your internal endpoint</span></p>
              <p className="pl-8"><span style={{ color: "#ff7b72" }}>return</span><span style={{ color: "#c9d1d9" }}> self.endpoint.call(prompt)</span></p>
              <p className="mt-2 pl-4">
                <span style={{ color: "#ff7b72" }}>def</span>
                <span style={{ color: "#d2a8ff" }}> count_tokens</span>
                <span style={{ color: "#c9d1d9" }}>(</span>
                <span style={{ color: "#ffa657" }}>self</span>
                <span style={{ color: "#c9d1d9" }}>, text: </span>
                <span style={{ color: "#79c0ff" }}>str</span>
                <span style={{ color: "#c9d1d9" }}>) -&gt; </span>
                <span style={{ color: "#79c0ff" }}>int</span>
                <span style={{ color: "#c9d1d9" }}>:</span>
              </p>
              <p className="pl-8"><span style={{ color: "#ff7b72" }}>return</span><span style={{ color: "#c9d1d9" }}> len(text.split())</span></p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
