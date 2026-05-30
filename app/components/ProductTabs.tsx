"use client";
import { useState } from "react";

const TABS = [
  "Compliance Reporting",
  "Lineage and Audit Trails",
  "Testing and Validation",
  "Model Cards",
  "Cost Intelligence",
] as const;
type Tab = (typeof TABS)[number];

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

const TAB_DATA: Record<Tab, { description: string; terminal: React.ReactNode }> = {
  "Compliance Reporting": {
    description:
      "EU AI Act and Colorado AI Act covered in one command. One `ryva governance report` generates a machine-readable JSON compliance report, model risk classification, and article-by-article scoring your legal team can act on.",
    terminal: (
      <TermBlock title="ryva governance report">
        <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva governance report</span></p>
        <p style={{ color: "#8b949e" }} className="mt-1">Generating compliance report...</p>
        <p style={{ color: "#8b949e" }}>Scoring Articles 9-15...</p>
        <div className="mt-2">
          <p><span style={{ color: "#8b949e" }}>EU AI Act score:       </span><span style={{ color: "#ffffff" }}>0.87</span><span style={{ color: "#16a34a" }}> — COMPLIANT</span></p>
          <p><span style={{ color: "#8b949e" }}>Colorado AI Act score: </span><span style={{ color: "#ffffff" }}>0.91</span><span style={{ color: "#16a34a" }}> — COMPLIANT</span></p>
          <p><span style={{ color: "#8b949e" }}>Risk classification:   </span><span style={{ color: "#fbbf24" }}>MEDIUM</span></p>
        </div>
        <p style={{ color: "#16a34a" }} className="mt-2">Report written to target/governance_report.json</p>
      </TermBlock>
    ),
  },
  "Lineage and Audit Trails": {
    description:
      "Every agent run records the full chain: input, prompt version, retrieval sources, tool calls, output, cost, and tokens. Each record is cryptographically signed. Run `ryva lineage verify` to prove data integrity to auditors.",
    terminal: (
      <TermBlock title="ryva lineage show f87951e4">
        <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva lineage show f87951e4</span></p>
        <div className="mt-1">
          <p><span style={{ color: "#8b949e" }}>Run:         </span><span style={{ color: "#67e8f9" }}>f87951e4</span></p>
          <p><span style={{ color: "#8b949e" }}>Agent:       </span><span style={{ color: "#ffffff" }}>intake_agent</span></p>
          <p><span style={{ color: "#8b949e" }}>Model:       </span><span style={{ color: "#ffffff" }}>claude-sonnet-4-5</span></p>
          <p><span style={{ color: "#8b949e" }}>Status:      </span><span style={{ color: "#16a34a" }}>success</span></p>
          <p><span style={{ color: "#8b949e" }}>Duration:    </span><span style={{ color: "#ffffff" }}>2201ms</span></p>
          <p><span style={{ color: "#8b949e" }}>Tokens:      </span><span style={{ color: "#ffffff" }}>1,820 in + 287 out</span></p>
          <p><span style={{ color: "#8b949e" }}>Signature:   </span><span style={{ color: "#16a34a" }}>verified</span></p>
        </div>
        <p style={{ color: "#16a34a" }} className="mt-2">Tamper-evident signature verified</p>
      </TermBlock>
    ),
  },
  "Testing and Validation": {
    description:
      "Nine test types built in. Schema, regression, adversarial, memory, RAG faithfulness, hallucination detection, fuzz (15 categories), fine-tune evaluation, and business alignment. All run in CI with a single command.",
    terminal: (
      <TermBlock title="ryva test --fuzz --agent intake_agent">
        <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva test --fuzz --agent intake_agent</span></p>
        <p style={{ color: "#8b949e" }} className="mt-1">Running 15 fuzz categories...</p>
        <div className="mt-1 space-y-0.5">
          {["empty","whitespace","very_long","special_chars","unicode","sql_injection","prompt_injection","null_bytes","newlines","numbers_only","json_input","html_tags","repeat_chars","mixed_case","negative_number"].map((cat) => (
            <div key={cat} className="flex gap-4">
              <span style={{ color: "#8b949e" }} className="w-36 shrink-0">{cat}</span>
              <span style={{ color: "#16a34a" }}>PASS</span>
            </div>
          ))}
        </div>
        <p style={{ color: "#16a34a" }} className="mt-2 font-medium">15/15 fuzz tests passed</p>
      </TermBlock>
    ),
  },
  "Model Cards": {
    description:
      "Auto-generated model cards that meet EU AI Act Article 13 transparency requirements. One command generates a structured JSON card covering intended purpose, training data provenance, known limitations, and risk classification.",
    terminal: (
      <TermBlock title="ryva modelcard generate --agent intake_agent">
        <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva modelcard generate --agent intake_agent</span></p>
        <p style={{ color: "#8b949e" }} className="mt-1">Generating model card...</p>
        <div className="mt-2">
          <p><span style={{ color: "#8b949e" }}>Agent:            </span><span style={{ color: "#ffffff" }}>intake_agent</span></p>
          <p><span style={{ color: "#8b949e" }}>Model:            </span><span style={{ color: "#ffffff" }}>claude-sonnet-4-5</span></p>
          <p><span style={{ color: "#8b949e" }}>Purpose:          </span><span style={{ color: "#ffffff" }}>intake classification</span></p>
          <p><span style={{ color: "#8b949e" }}>Risk class:       </span><span style={{ color: "#fbbf24" }}>MEDIUM</span></p>
          <p><span style={{ color: "#8b949e" }}>Article 13:       </span><span style={{ color: "#16a34a" }}>PASS</span></p>
        </div>
        <p style={{ color: "#16a34a" }} className="mt-2">Written: model_cards/intake_agent.json</p>
      </TermBlock>
    ),
  },
  "Cost Intelligence": {
    description:
      "Per-agent cost tracking, budget alerts, and 30-day forecasting. Know exactly what each agent run costs before your cloud bill arrives.",
    terminal: (
      <TermBlock title="ryva forecast --agent intake_agent">
        <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva forecast --agent intake_agent</span></p>
        <p style={{ color: "#8b949e" }} className="mt-1">Forecast: intake_agent (last 30 days)</p>
        <div className="mt-2">
          <p><span style={{ color: "#8b949e" }}>Calls:         </span><span style={{ color: "#ffffff" }}>1,240</span></p>
          <p><span style={{ color: "#8b949e" }}>Avg cost/call: </span><span style={{ color: "#fbbf24" }}>$0.0018</span></p>
          <p><span style={{ color: "#8b949e" }}>Projected/mo:  </span><span style={{ color: "#ffffff" }}>$2.23</span></p>
          <p><span style={{ color: "#8b949e" }}>Budget:        </span><span style={{ color: "#ffffff" }}>$25.00</span></p>
          <p><span style={{ color: "#8b949e" }}>Status:        </span><span style={{ color: "#16a34a" }}>13.5% used — on track</span></p>
        </div>
        <p style={{ color: "#16a34a" }} className="mt-2">Budget forecast: within limit</p>
      </TermBlock>
    ),
  },
};

export default function ProductTabs() {
  const [active, setActive] = useState<Tab>("Compliance Reporting");

  const { description, terminal } = TAB_DATA[active];

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              active === tab
                ? "bg-[#16a34a] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content: two-column */}
      <div
        key={active}
        className="grid md:grid-cols-2 gap-10 items-start"
        style={{ animation: "fadeUp 0.18s ease both" }}
      >
        <div>
          <p className="text-gray-600 leading-relaxed text-base">{description}</p>
        </div>
        <div>{terminal}</div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
