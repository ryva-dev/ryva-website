"use client";
import { useState, useEffect } from "react";

const CYCLES = [
  {
    cmd: "ryva test",
    output: [
      "Running schema, latency, regression, adversarial...",
      "4/4 tests passed",
    ],
  },
  {
    cmd: "ryva test --hallucination",
    output: [
      "Running hallucination detection...",
      "3/3 factual claims verified",
      "0 hallucinations detected",
    ],
  },
  {
    cmd: "ryva test --adversarial",
    output: [
      "Testing prompt injection (15 variants)...",
      "Testing jailbreak attempts (8 variants)...",
      "9/9 adversarial tests passed",
    ],
  },
];

export default function CyclingTerminal() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % CYCLES.length), 3200);
    return () => clearInterval(t);
  }, []);

  const current = CYCLES[idx];

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div
        className="px-4 py-2.5 flex items-center gap-1.5"
        style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
      </div>
      <div
        className="bg-[#0d1117] px-5 py-4"
        style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, lineHeight: "1.9", minHeight: 140 }}
      >
        <p>
          <span className="text-gray-500">$ </span>
          <span className="text-[#16a34a]">{current.cmd}</span>
        </p>
        {current.output.map((line, i) => (
          <p key={i} className="text-gray-400 pl-2">{line}</p>
        ))}
      </div>
    </div>
  );
}
