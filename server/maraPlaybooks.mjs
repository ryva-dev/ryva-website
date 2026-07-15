import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../workers/mara/playbooks");
const REQUIRED = ["id", "version", "applicable_task_types", "load_conditions", "do_not_load_conditions", "required_context", "optional_context", "allowed_tools", "autonomy_level", "model_tier", "maximum_context_tokens", "output_schema", "quality_rubric", "escalation_rules"];

function scalar(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try { return JSON.parse(trimmed); } catch { return trimmed.replace(/^['"]|['"]$/g, ""); }
}

export function parsePlaybook(source, filename = "playbook.md") {
  const match = String(source).match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) throw new Error(`${filename} has no valid front matter.`);
  const metadata = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 1) throw new Error(`${filename} has malformed front matter: ${line}`);
    metadata[line.slice(0, colon).trim()] = scalar(line.slice(colon + 1));
  }
  const missing = REQUIRED.filter((key) => metadata[key] === undefined);
  if (missing.length) throw new Error(`${filename} missing metadata: ${missing.join(", ")}`);
  return { filename, metadata, content: match[2].trim() };
}

export async function loadMaraPlaybooks(directory = DEFAULT_DIRECTORY) {
  const files = (await readdir(directory)).filter((name) => name.endsWith(".md")).sort();
  return Promise.all(files.map(async (filename) => parsePlaybook(await readFile(path.join(directory, filename), "utf8"), filename)));
}

function conditionMatches(condition, context) {
  if (condition === "always") return true;
  if (condition.startsWith("candidate:")) return context.candidateTypes.has(condition.slice(10));
  if (condition.startsWith("risk:")) return context.riskTypes.has(condition.slice(5));
  if (condition.startsWith("state:")) return Boolean(context.state?.[condition.slice(6)]);
  return false;
}

export function retrieveRelevantPlaybooks(playbooks, { state = {}, candidates = [] } = {}) {
  const context = {
    state,
    candidateTypes: new Set(candidates.map((c) => c.candidateType)),
    riskTypes: new Set((state.risks || []).map((r) => r.type))
  };
  return playbooks.filter(({ metadata }) => {
    const loads = Array.isArray(metadata.load_conditions) ? metadata.load_conditions : [metadata.load_conditions];
    const excludes = Array.isArray(metadata.do_not_load_conditions) ? metadata.do_not_load_conditions : [];
    return loads.some((value) => conditionMatches(value, context)) && !excludes.some((value) => conditionMatches(value, context));
  });
}

export { REQUIRED as REQUIRED_PLAYBOOK_METADATA };
