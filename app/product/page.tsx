import Link from "next/link";

const TEST_TYPES = [
  {
    cmd: "ryva test",
    title: "Schema validation",
    desc: "Validates that every agent output matches the declared JSON schema. Catches format regressions and breaking changes before they reach users.",
    catches: "Catches: missing required fields, wrong types, extra keys.",
  },
  {
    cmd: "ryva test --regression",
    title: "Regression comparison",
    desc: "Compares current outputs against a saved baseline using semantic similarity. Flags any response that diverges beyond the configured threshold.",
    catches: "Catches: prompt changes that silently alter behavior.",
  },
  {
    cmd: "ryva test --adversarial",
    title: "Adversarial probing",
    desc: "Fires crafted inputs at the agent: prompt injections, jailbreak attempts, contradictory instructions, and boundary-pushing edge cases.",
    catches: "Catches: security vulnerabilities and safety failures.",
  },
  {
    cmd: "ryva test --memory",
    title: "Memory retention",
    desc: "Runs multi-turn conversations and verifies the agent correctly retains and references context from earlier turns.",
    catches: "Catches: context window failures and state corruption.",
  },
  {
    cmd: "ryva test --rag",
    title: "RAG faithfulness",
    desc: "Tests retrieval pipelines for relevance and faithfulness. Verifies answers are grounded in retrieved documents, not hallucinated.",
    catches: "Catches: retrieval failures and unsupported claims.",
  },
  {
    cmd: "ryva test --hallucination",
    title: "Hallucination detection",
    desc: "Submits prompts with known facts and detects when the model generates plausible-sounding but factually incorrect claims.",
    catches: "Catches: factual errors and knowledge boundary violations.",
  },
  {
    cmd: "ryva test --fuzz",
    title: "Fuzz testing",
    desc: "Fires 15 fuzz input categories at the agent: empty strings, unicode, SQL injection, prompt injection, null bytes, HTML tags, and more.",
    catches: "Catches: input handling failures and injection vulnerabilities.",
  },
  {
    cmd: "ryva test --finetune",
    title: "Fine-tune evaluation",
    desc: "Runs the full test suite against both the base model and a fine-tuned variant, reporting accuracy delta and regression count side by side.",
    catches: "Catches: fine-tune regressions and capability drift.",
  },
  {
    cmd: "ryva test --alignment",
    title: "Business alignment",
    desc: "Checks that agent outputs conform to declared alignment rules: tone, schema constraints, length bounds, compliance flags, and brand guidelines.",
    catches: "Catches: policy violations and off-brand responses.",
  },
];

const ALIGNMENT_RULES = [
  { type: "schema",     example: "Output must include fields: summary, confidence, category" },
  { type: "length",     example: "Response must be between 50 and 500 tokens" },
  { type: "tone",       example: "Response tone must match: professional, neutral" },
  { type: "compliance", example: "Response must not reference competitor products" },
  { type: "safety",     example: "Response must not contain personally identifiable information" },
  { type: "factual",    example: "Claims must be grounded in the provided retrieval context" },
  { type: "brand",      example: "Response must use approved terminology from brand_glossary.yaml" },
];

const ARTICLES = [
  {
    id: "Article 9",
    req: "Risk management system",
    how: "Ryva records all test results, lineage data, and governance scores as a structured risk management history.",
  },
  {
    id: "Article 10",
    req: "Data governance and management",
    how: "PII masking is applied before every log write. Retrieval sources are recorded in lineage. Data provenance is traceable.",
  },
  {
    id: "Article 12",
    req: "Record-keeping",
    how: "Every run produces a tamper-evident lineage record with HMAC signature. Records are queryable and exportable.",
  },
  {
    id: "Article 13",
    req: "Transparency to users",
    how: "Alignment rules declare the system's constraints explicitly. Governance reports are human-readable and machine-readable.",
  },
  {
    id: "Article 14",
    req: "Human oversight",
    how: "Ryva flags high-risk runs for review. Alignment failures block downstream steps until a human approves.",
  },
  {
    id: "Article 15",
    req: "Accuracy and robustness",
    how: "Fuzz testing, adversarial testing, and regression baselines continuously verify accuracy under varied inputs.",
  },
];

export default function ProductPage() {
  return (
    <div className="bg-white text-gray-900">

      {/* Hero */}
      <section className="text-center px-6 py-24" style={{ borderBottom: "1px solid #f0f0f0" }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="font-bold text-gray-900 tracking-tight mb-5" style={{ fontSize: "clamp(36px,5vw,56px)", lineHeight: 1.1 }}>
            Everything you need to ship AI with confidence.
          </h1>
          <p className="text-gray-500 mx-auto mb-8" style={{ fontSize: 18, maxWidth: 580, lineHeight: 1.65 }}>
            Ryva is a full platform: test runner, lineage engine, alignment checker, governance reporter, cost forecaster, and model registry. One CLI, one config, one place to look when something goes wrong.
          </p>
          <Link
            href="https://github.com/ryva-dev/ryva"
            className="bg-gray-900 text-white text-sm font-medium px-7 py-3 rounded-md hover:bg-gray-700 transition-colors inline-block"
          >
            Get started free
          </Link>
        </div>
      </section>

      {/* Testing suite */}
      <section id="testing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-xl mb-12">
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(26px,3.5vw,38px)" }}>
              Nine test types built in
            </h2>
            <p className="text-gray-500 leading-relaxed">
              Add <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva test</code> to your CI pipeline. It runs all enabled test types on every push and stores results alongside your lineage records.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {TEST_TYPES.map((t) => (
              <div key={t.cmd} className="border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors">
                <code className="text-[#16a34a] text-xs mb-3 block" style={{ fontFamily: "var(--font-geist-mono)" }}>{t.cmd}</code>
                <h3 className="font-semibold text-gray-900 text-sm mb-2">{t.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed mb-2">{t.desc}</p>
                <p className="text-gray-400 text-xs italic">{t.catches}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lineage engine */}
      <section id="lineage" style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }} className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(26px,3.5vw,38px)" }}>
              Full lineage on every run
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              Every agent run produces a lineage record containing the input hash, prompt version and hash, retrieval chunk hashes, tool call log, output hash, token counts, and cost. Nothing is omitted.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              Lineage records are signed with an HMAC signature computed from your project key. The signature covers the full record, so any tampering is detectable. Run
              {" "}<code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva lineage verify</code>{" "}
              to prove integrity to auditors.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              Parent run IDs link multi-step pipelines into a full execution graph. You can reconstruct the complete history of any agent decision from first input to final output.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              Export to JSON for your legal team. Query with
              {" "}<code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva lineage show</code>{" "}
              from the CLI. Browse in Ryva Cloud with full-text search.
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-gray-400 text-xs ml-2" style={{ fontFamily: "var(--font-geist-mono)" }}>ryva lineage show f87951e4</span>
            </div>
            <div className="bg-[#0d1117] p-5" style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, lineHeight: "1.85" }}>
              <p><span className="text-gray-500">Run:         </span><span className="text-cyan-400">f87951e4</span></p>
              <p><span className="text-gray-500">Agent:       </span><span className="text-white">intake_agent</span></p>
              <p><span className="text-gray-500">Parent:      </span><span className="text-gray-400">3c5d9a2b</span></p>
              <p className="mt-2"><span className="text-gray-500">Input hash:  </span><span className="text-gray-300">sha256:8f3a9c2d...e4b7f1a8</span></p>
              <p><span className="text-gray-500">Prompt:      </span><span className="text-gray-300">v2.1 (sha256:7a2b5e9f)</span></p>
              <p><span className="text-gray-500">RAG chunks:  </span><span className="text-gray-300">3 docs [a1b2, e5f6, c9d0]</span></p>
              <p><span className="text-gray-500">Tool calls:  </span><span className="text-gray-300">validate_schema, fetch_context</span></p>
              <p><span className="text-gray-500">Output hash: </span><span className="text-gray-300">sha256:2d8e1c7b...f5a9b3c6</span></p>
              <p><span className="text-gray-500">Tokens:      </span><span className="text-gray-300">1,820 in + 287 out</span></p>
              <p><span className="text-gray-500">Cost:        </span><span className="text-gray-300">$0.0018</span></p>
              <p className="text-[#16a34a] mt-2">Tamper-evident signature verified</p>
            </div>
          </div>
        </div>
      </section>

      {/* Business alignment */}
      <section id="alignment" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-xl mb-12">
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(26px,3.5vw,38px)" }}>
              Business alignment runs on every agent call
            </h2>
            <p className="text-gray-500 leading-relaxed">
              Declare alignment rules in your agent YAML. Ryva evaluates them on every
              {" "}<code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva run</code>{" "}
              and fails the run if any rule is violated. Seven rule types are built in.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {ALIGNMENT_RULES.map((r) => (
              <div key={r.type} className="border border-gray-200 rounded-lg p-4 flex gap-4">
                <code className="text-[#16a34a] text-xs shrink-0 pt-0.5 w-20" style={{ fontFamily: "var(--font-geist-mono)" }}>{r.type}</code>
                <p className="text-gray-500 text-sm leading-relaxed">{r.example}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Governance */}
      <section id="governance" style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }} className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-xl mb-12">
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(26px,3.5vw,38px)" }}>
              EU AI Act compliance out of the box
            </h2>
            <p className="text-gray-500 leading-relaxed mb-4">
              Run <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva governance report</code> to generate a machine-readable compliance report. Covers Articles 9, 10, 12, 13, 14, and 15. Exports to JSON.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {ARTICLES.map((a) => (
              <div key={a.id} className="border border-gray-200 rounded-xl p-5 bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-semibold text-[#16a34a] bg-green-50 border border-green-200 rounded px-2 py-0.5">{a.id}</span>
                  <span className="font-semibold text-gray-900 text-sm">{a.req}</span>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed">{a.how}</p>
              </div>
            ))}
          </div>
          {/* JSON output structure */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-gray-400 text-xs ml-2" style={{ fontFamily: "var(--font-geist-mono)" }}>target/governance_report.json</span>
            </div>
            <div className="bg-[#0d1117] p-5" style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, lineHeight: "1.85" }}>
              <p className="text-gray-400">{`{`}</p>
              <p className="text-gray-400 pl-4">{`"project": `}<span className="text-yellow-400">"intake-pipeline"</span>,</p>
              <p className="text-gray-400 pl-4">{`"generated": `}<span className="text-yellow-400">"2026-05-27T10:23:45Z"</span>,</p>
              <p className="text-gray-400 pl-4">{`"compliance_score": `}<span className="text-[#16a34a]">0.87</span>,</p>
              <p className="text-gray-400 pl-4">{`"status": `}<span className="text-[#16a34a]">"COMPLIANT"</span>,</p>
              <p className="text-gray-400 pl-4">{`"risk_classification": `}<span className="text-yellow-400">"medium"</span>,</p>
              <p className="text-gray-400 pl-4">{`"articles": {`}</p>
              <p className="text-gray-400 pl-8">{`"article_9":  { "score": `}<span className="text-[#16a34a]">1.00</span>{`, "status": "PASS" },`}</p>
              <p className="text-gray-400 pl-8">{`"article_10": { "score": `}<span className="text-[#16a34a]">0.92</span>{`, "status": "PASS" },`}</p>
              <p className="text-gray-400 pl-8">{`"article_12": { "score": `}<span className="text-[#16a34a]">0.95</span>{`, "status": "PASS" },`}</p>
              <p className="text-gray-400 pl-8">{`"article_13": { "score": `}<span className="text-[#16a34a]">0.84</span>{`, "status": "PASS" },`}</p>
              <p className="text-gray-400 pl-8">{`"article_14": { "score": `}<span className="text-[#16a34a]">0.81</span>{`, "status": "PASS" },`}</p>
              <p className="text-gray-400 pl-8">{`"article_15": { "score": `}<span className="text-[#16a34a]">0.87</span>{`, "status": "PASS" }`}</p>
              <p className="text-gray-400 pl-4">{`}`}</p>
              <p className="text-gray-400">{`}`}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Observability */}
      <section id="observability" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-xl mb-12">
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(26px,3.5vw,38px)" }}>
              Full observability on every run
            </h2>
            <p className="text-gray-500 leading-relaxed">
              Every agent run is traced automatically. Inspect any run with
              {" "}<code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva traces show</code>{" "}
              to see the exact prompt, response, model, latency, cost, and PII masking status.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-gray-400 text-xs ml-2" style={{ fontFamily: "var(--font-geist-mono)" }}>ryva traces show f87951e4</span>
              </div>
              <div className="bg-[#0d1117] p-5" style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, lineHeight: "1.85" }}>
                <p><span className="text-gray-500">Trace:    </span><span className="text-cyan-400">f87951e4</span></p>
                <p><span className="text-gray-500">Agent:    </span><span className="text-white">intake_agent</span></p>
                <p><span className="text-gray-500">Model:    </span><span className="text-white">claude-sonnet-4-5</span></p>
                <p><span className="text-gray-500">Status:   </span><span className="text-[#16a34a]">success</span></p>
                <p><span className="text-gray-500">Duration: </span><span className="text-white">2201ms</span></p>
                <p><span className="text-gray-500">Cost:     </span><span className="text-white">$0.0018</span></p>
                <p><span className="text-gray-500">PII:      </span><span className="text-yellow-400">masked (3 fields)</span></p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-gray-400 text-xs ml-2" style={{ fontFamily: "var(--font-geist-mono)" }}>ryva forecast</span>
              </div>
              <div className="bg-[#0d1117] p-5" style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, lineHeight: "1.85" }}>
                <p className="text-gray-500 mb-2">my-project (last 30 days)</p>
                <p><span className="text-white">intake_agent     </span><span className="text-gray-500">1,240 calls  </span><span className="text-yellow-400">$0.0018  </span><span className="text-white">$2.23/mo</span></p>
                <p><span className="text-white">classifier_agent </span><span className="text-gray-500">  890 calls  </span><span className="text-yellow-400">$0.0009  </span><span className="text-white">$0.80/mo</span></p>
                <p><span className="text-white">qa_extractor     </span><span className="text-gray-500">  320 calls  </span><span className="text-yellow-400">$0.0011  </span><span className="text-white">$0.35/mo</span></p>
                <div className="border-t border-gray-800 mt-3 pt-3">
                  <p className="text-gray-500">Total: <span className="text-white">$3.38</span> / $25.00 budget <span className="text-[#16a34a]">(13.5%)</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Model registry */}
      <section id="registry" style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }} className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(26px,3.5vw,38px)" }}>
              Model registry
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              Register every model your project uses as a versioned entry. Centralize provider credentials, aliases, and capability metadata. One source of truth queried with
              {" "}<code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva registry list</code>.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              Models can be tagged with aliases like <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">prod</code> or <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">canary</code>. Switch models in one place rather than hunting through YAML files. Versioned entries mean you always know which model ran on which date.
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-gray-400 text-xs ml-2" style={{ fontFamily: "var(--font-geist-mono)" }}>ryva registry list</span>
            </div>
            <div className="bg-[#0d1117] p-5" style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, lineHeight: "1.85" }}>
              <p className="text-gray-600 mb-1">NAME               VER    PROVIDER    ALIAS         STATUS</p>
              <p><span className="text-white">claude-sonnet-4-5  </span><span className="text-gray-500">4.5    anthropic   claude-main   </span><span className="text-[#16a34a]">active</span></p>
              <p><span className="text-white">claude-haiku-3     </span><span className="text-gray-500">3.0    anthropic   claude-fast   </span><span className="text-[#16a34a]">active</span></p>
              <p><span className="text-white">gpt-4o             </span><span className="text-gray-500">2024   openai      gpt-main      </span><span className="text-[#16a34a]">active</span></p>
              <p><span className="text-white">gpt-4o-mini        </span><span className="text-gray-500">2024   openai      gpt-cheap     </span><span className="text-[#16a34a]">active</span></p>
              <p><span className="text-white">gemini-1.5-pro     </span><span className="text-gray-500">1.5    google      gemini-main   </span><span className="text-[#16a34a]">active</span></p>
              <p><span className="text-white">gemini-1.5-flash   </span><span className="text-gray-500">1.5    google      gemini-fast   </span><span className="text-[#16a34a]">active</span></p>
              <p><span className="text-white">llama3.1:70b       </span><span className="text-gray-500">70b    ollama      local-large   </span><span className="text-[#16a34a]">active</span></p>
              <p><span className="text-white">llama3.1:8b        </span><span className="text-gray-500">8b     ollama      local-fast    </span><span className="text-[#16a34a]">active</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* Plugin system */}
      <section id="plugins" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-xl mb-10">
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(26px,3.5vw,38px)" }}>
              Extensible plugin system
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              Ryva ships with nine test types and four providers. When those are not enough, the plugin system lets you add your own without forking the core.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              Write a custom test type by implementing the <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">TestRunner</code> interface and registering it in your project config. Ryva will call your runner alongside its built-in types and report results in the same format.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              Add a custom provider by implementing the <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ModelProvider</code> interface. Useful for internal models, private endpoints, or any LLM not in the built-in registry.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-2">Custom test types</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Implement <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">TestRunner</code>. Register in <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva.yaml</code>. Results appear in the standard test report alongside built-in types.</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-2">Custom providers</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Implement <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ModelProvider</code>. Supports streaming, token counting, and cost estimation. Works with lineage tracking and cost forecasting automatically.</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
