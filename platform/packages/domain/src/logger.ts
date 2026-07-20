import type { AppConfig } from "../../config/src/index.js";

type Level = "debug" | "info" | "warn" | "error";
const priorities: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const forbiddenKey = /(password|secret|token|authorization|cookie|body|payload|content)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        forbiddenKey.test(key) ? "[redacted]" : sanitize(item, depth + 1)
      ])
    );
  }
  if (typeof value === "string" && value.length > 1000) return `${value.slice(0, 1000)}…`;
  return value;
}

export type Logger = {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
};

export function createLogger(configuration: Pick<AppConfig, "LOG_LEVEL">): Logger {
  const write = (level: Level, message: string, fields?: Record<string, unknown>): void => {
    if (priorities[level] < priorities[configuration.LOG_LEVEL]) return;
    const record = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(fields ? (sanitize(fields) as Record<string, unknown>) : {})
    });
    if (level === "error") process.stderr.write(`${record}\n`);
    else process.stdout.write(`${record}\n`);
  };
  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields)
  };
}
