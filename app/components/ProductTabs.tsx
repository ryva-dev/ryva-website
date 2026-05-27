"use client";
import { useState } from "react";

const TABS = ["Testing", "Lineage", "Governance", "Observability", "Cost Intelligence"] as const;
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

const FUZZ = [
  "empty","whitespace","very_long","special_chars","unicode",
  "sql_injection","prompt_injection","null_bytes","newlines","numbers_only",
  "json_input","html_tags","repeat_chars","mixed_case","negative_number",
];

function TestingTab() {
  return (
    <TermBlock title="ryva test --fuzz --agent intake_agent">
      <p className="text-gray-500 mb-3">Running 15 fuzz categories...</p>
      <div className="space-y-0.5">
        {FUZZ.map((cat) => (
          <div key={cat} className="flex gap-4">
            <span className="text-gray-500 w-40 shrink-0">{cat}</span>
            <span className="text-[#16a34a]">PASS</span>
          </div>
        ))}
      </div>
      <p className="text-[#16a34a] mt-3 font-medium">15/15 fuzz tests passed</p>
    </TermBlock>
  );
}

function LineageTab() {
  return (
    <TermBlock title="ryva lineage show f87951e4">
      <div className="space-y-0.5">
        <p><span className="text-gray-500">Run:         </span><span className="text-cyan-400">f87951e4</span></p>
        <p><span className="text-gray-500">Agent:       </span><span className="text-white">intake_agent</span></p>
        <p><span className="text-gray-500">Parent run:  </span><span className="text-gray-400">3c5d9a2b</span></p>
      </div>
      <div className="mt-3 border border-blue-900/40 rounded bg-blue-950/10 px-3 py-2">
        <p className="text-blue-400 mb-1">Input</p>
        <p><span className="text-gray-500">  Hash:    </span><span className="text-gray-300">sha256:8f3a9c2d...e4b7f1a8</span></p>
        <p><span className="text-gray-500">  Source:  </span><span className="text-gray-300">user_request_v1.yaml</span></p>
      </div>
      <div className="mt-2 border border-purple-900/40 rounded bg-purple-950/10 px-3 py-2">
        <p className="text-purple-400 mb-1">Prompt</p>
        <p><span className="text-gray-500">  Version: </span><span className="text-gray-300">v2.1</span></p>
        <p><span className="text-gray-500">  Hash:    </span><span className="text-gray-300">sha256:7a2b5e9f...c3d4a6b1</span></p>
      </div>
      <div className="mt-2 border border-yellow-900/40 rounded bg-yellow-950/10 px-3 py-2">
        <p className="text-yellow-400 mb-1">Retrieval</p>
        <p><span className="text-gray-500">  Chunks:  </span><span className="text-gray-300">3 documents</span></p>
        <p><span className="text-gray-500">  Hashes:  </span><span className="text-gray-300">[a1b2c3d4, e5f6a7b8, c9d0e1f2]</span></p>
      </div>
      <div className="mt-2">
        <p><span className="text-gray-500">Tool calls:  </span><span className="text-gray-300">validate_schema (1), fetch_context (1)</span></p>
        <p><span className="text-gray-500">Output hash: </span><span className="text-gray-300">sha256:2d8e1c7b...f5a9b3c6</span></p>
        <p><span className="text-gray-500">Tokens:      </span><span className="text-gray-300">1,820 in + 287 out</span></p>
      </div>
      <p className="text-[#16a34a] mt-3">Tamper-evident signature verified</p>
    </TermBlock>
  );
}

const ARTICLES = [
  { id: "Article 9",  label: "Risk management system",           score: "1.00", pass: true },
  { id: "Article 10", label: "Data governance practices",         score: "0.92", pass: true },
  { id: "Article 12", label: "Record-keeping",                    score: "0.95", pass: true },
  { id: "Article 13", label: "Transparency to users",             score: "0.84", pass: true },
  { id: "Article 14", label: "Human oversight",                   score: "0.81", pass: true },
  { id: "Article 15", label: "Accuracy and robustness",           score: "0.87", pass: true },
];

function GovernanceTab() {
  return (
    <TermBlock title="ryva governance report">
      <p className="text-gray-500 mb-3">EU AI Act Compliance Report — intake-pipeline</p>
      <div className="space-y-0.5">
        <div className="flex gap-3 text-gray-600 mb-1">
          <span className="w-24">ARTICLE</span>
          <span className="flex-1">REQUIREMENT</span>
          <span className="w-12">SCORE</span>
          <span className="w-12">STATUS</span>
        </div>
        {ARTICLES.map((a) => (
          <div key={a.id} className="flex gap-3">
            <span className="text-gray-500 w-24">{a.id}</span>
            <span className="text-gray-300 flex-1">{a.label}</span>
            <span className="text-white w-12">{a.score}</span>
            <span className="text-[#16a34a] w-12">PASS</span>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-800 mt-3 pt-3">
        <p><span className="text-gray-500">Overall score:       </span><span className="text-white font-medium">0.87</span><span className="text-[#16a34a]"> (COMPLIANT)</span></p>
        <p><span className="text-gray-500">Risk classification: </span><span className="text-yellow-400">MEDIUM</span></p>
      </div>
      <p className="text-[#16a34a] mt-2">Report written to target/governance_report.json</p>
    </TermBlock>
  );
}

function ObservabilityTab() {
  return (
    <TermBlock title="ryva traces show f87951e4">
      <div className="space-y-0.5">
        <p><span className="text-gray-500">Trace:    </span><span className="text-cyan-400">f87951e4</span></p>
        <p><span className="text-gray-500">Agent:    </span><span className="text-white">intake_agent</span></p>
        <p><span className="text-gray-500">Model:    </span><span className="text-white">claude-sonnet-4-5 (anthropic)</span></p>
        <p><span className="text-gray-500">Status:   </span><span className="text-[#16a34a]">success</span></p>
        <p><span className="text-gray-500">Duration: </span><span className="text-white">2201ms</span></p>
        <p><span className="text-gray-500">Tokens:   </span><span className="text-white">1,820 in + 287 out</span></p>
        <p><span className="text-gray-500">Cost:     </span><span className="text-white">$0.0018</span></p>
        <p><span className="text-gray-500">PII:      </span><span className="text-yellow-400">masked (3 fields redacted)</span></p>
      </div>
      <div className="mt-3 border border-blue-900/50 rounded bg-blue-950/20 px-3 py-2">
        <p className="text-blue-400 mb-1">Step 1 - Prompt</p>
        <p className="text-gray-400">{`"You are a precise intake classification assistant..."`}</p>
      </div>
      <div className="mt-2 border border-green-900/50 rounded bg-green-950/20 px-3 py-2">
        <p className="text-[#16a34a] mb-1">Step 2 - Response</p>
        <p className="text-gray-400">{`{"classification": "high_priority", "confidence": 0.94}`}</p>
      </div>
    </TermBlock>
  );
}

function CostTab() {
  return (
    <TermBlock title="ryva forecast">
      <p className="text-gray-500 mb-3">Forecast: my-project  (last 30 days)</p>
      <div className="space-y-0.5 mb-3">
        <div className="flex gap-3 text-gray-600 mb-1">
          <span className="w-40">AGENT</span>
          <span className="w-16">CALLS</span>
          <span className="w-20">COST/CALL</span>
          <span>MONTHLY</span>
        </div>
        <div className="flex gap-3">
          <span className="text-white w-40">intake_agent</span>
          <span className="text-gray-400 w-16">1,240</span>
          <span className="text-yellow-400 w-20">$0.0018</span>
          <span className="text-white">$2.23</span>
        </div>
        <div className="flex gap-3">
          <span className="text-white w-40">classifier_agent</span>
          <span className="text-gray-400 w-16">890</span>
          <span className="text-yellow-400 w-20">$0.0009</span>
          <span className="text-white">$0.80</span>
        </div>
        <div className="flex gap-3">
          <span className="text-white w-40">qa_extractor</span>
          <span className="text-gray-400 w-16">320</span>
          <span className="text-yellow-400 w-20">$0.0011</span>
          <span className="text-white">$0.35</span>
        </div>
      </div>
      <div className="border-t border-gray-800 pt-3 mb-3">
        <p><span className="text-gray-500">Total: </span><span className="text-white">$3.38</span><span className="text-gray-500"> of </span><span className="text-gray-400">$25.00 budget</span><span className="text-[#16a34a]"> (13.5% used)</span></p>
        <p className="text-gray-500">At current pace: budget lasts <span className="text-white">7.4 months</span></p>
      </div>
      <p className="text-gray-500 mb-1">$ <span className="text-[#16a34a]">ryva compare claude-sonnet-4-5 claude-haiku-3</span></p>
      <div className="border border-green-900/40 rounded bg-green-950/10 px-3 py-2">
        <p className="text-[#16a34a] mb-1">Cheaper alternative — all tests pass:</p>
        <p className="text-gray-400">claude-haiku-3 saves $1.36/mo</p>
      </div>
    </TermBlock>
  );
}

const TAB_CONTENT: Record<Tab, React.ReactNode> = {
  Testing:           <TestingTab />,
  Lineage:           <LineageTab />,
  Governance:        <GovernanceTab />,
  Observability:     <ObservabilityTab />,
  "Cost Intelligence": <CostTab />,
};

export default function ProductTabs() {
  const [active, setActive] = useState<Tab>("Testing");

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-gray-100 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-2.5 text-sm font-medium shrink-0 transition-colors border-b-2 -mb-px ${
              active === tab
                ? "text-gray-900 border-gray-900"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div
        key={active}
        style={{
          animation: "fadeUp 0.18s ease both",
        }}
      >
        {TAB_CONTENT[active]}
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
