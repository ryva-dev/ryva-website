"use client";
import { useState, useEffect } from "react";

type TermLine = { type: "cmd" | "out" | "blank"; text: string };

const SEQUENCE: TermLine[] = [
  { type: "cmd",   text: "ryva compile" },
  { type: "out",   text: "✓ Compiled — 3 agents · 2 pipelines · 0 errors" },
  { type: "blank", text: "" },
  { type: "cmd",   text: "ryva test --fuzz --agent intake_agent" },
  { type: "out",   text: "15/15 fuzz tests passed" },
  { type: "blank", text: "" },
  { type: "cmd",   text: "ryva governance report" },
  { type: "out",   text: "EU AI Act score: 0.87 — COMPLIANT" },
  { type: "out",   text: "Report → target/governance_report.json" },
  { type: "blank", text: "" },
  { type: "cmd",   text: "ryva audit export" },
  { type: "out",   text: "✓ Audit package ready" },
  { type: "out",   text: "  governance_report.json" },
  { type: "out",   text: "  model_cards/intake_agent.json" },
  { type: "out",   text: "  lineage/ (142 records, all verified)" },
  { type: "out",   text: "  eu_ai_act_checklist.md" },
  { type: "out",   text: "  colorado_ai_act_checklist.md" },
];

export default function TerminalHero() {
  const [committed, setCommitted] = useState<TermLine[]>([]);
  const [lineIdx, setLineIdx]     = useState(0);
  const [charIdx, setCharIdx]     = useState(0);

  useEffect(() => {
    if (lineIdx >= SEQUENCE.length) {
      const t = setTimeout(() => {
        setCommitted([]);
        setLineIdx(0);
        setCharIdx(0);
      }, 3000);
      return () => clearTimeout(t);
    }

    const line = SEQUENCE[lineIdx];

    if (line.type === "blank") {
      const t = setTimeout(() => {
        setCommitted((p) => [...p, line]);
        setLineIdx((i) => i + 1);
      }, 10);
      return () => clearTimeout(t);
    }

    if (line.type === "out") {
      const t = setTimeout(() => {
        setCommitted((p) => [...p, line]);
        setLineIdx((i) => i + 1);
      }, 180);
      return () => clearTimeout(t);
    }

    // cmd: type char by char at 50ms/char
    if (charIdx < line.text.length) {
      const t = setTimeout(() => setCharIdx((i) => i + 1), 50);
      return () => clearTimeout(t);
    }

    // finished typing cmd: 380ms pause before showing output
    const t = setTimeout(() => {
      setCommitted((p) => [...p, line]);
      setLineIdx((i) => i + 1);
      setCharIdx(0);
    }, 380);
    return () => clearTimeout(t);
  }, [lineIdx, charIdx]);

  const activeLine  = lineIdx < SEQUENCE.length ? SEQUENCE[lineIdx] : null;
  const typedSoFar  = activeLine?.type === "cmd" ? activeLine.text.slice(0, charIdx) : null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm" style={{ height: 460 }}>
      {/* macOS dots header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}
      >
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span
          className="text-gray-400 text-xs ml-2"
          style={{ fontFamily: "var(--font-geist-mono)" }}
        >
          ~/my-project
        </span>
      </div>

      {/* Terminal body */}
      <div
        className="bg-[#0d1117] px-6 py-5"
        style={{
          fontFamily: "var(--font-geist-mono)",
          fontSize: 13,
          lineHeight: "1.9",
          height: "calc(460px - 45px)",
          overflow: "hidden",
        }}
      >
        {committed.map((line, i) => {
          if (line.type === "blank") return <div key={i} className="h-2" />;
          if (line.type === "cmd") {
            return (
              <div key={i}>
                <span style={{ color: "#6b7280" }}>$ </span>
                <span style={{ color: "#16a34a" }}>{line.text}</span>
              </div>
            );
          }
          return (
            <div key={i} style={{ color: "#8b949e" }}>
              {line.text}
            </div>
          );
        })}

        {typedSoFar !== null && (
          <div>
            <span style={{ color: "#6b7280" }}>$ </span>
            <span style={{ color: "#16a34a" }}>{typedSoFar}</span>
            <span
              className="animate-blink inline-block ml-px"
              style={{
                width: 7,
                height: 15,
                background: "#16a34a",
                verticalAlign: "middle",
                display: "inline-block",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
