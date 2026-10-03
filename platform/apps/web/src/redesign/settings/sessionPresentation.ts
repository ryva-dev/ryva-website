/** Turn raw user-agent strings into calm, human-readable session labels. */

export function formatSessionClient(userAgent: string | null | undefined): {
  label: string;
  detail?: string;
} {
  const raw = userAgent?.trim() ?? "";
  if (!raw) return { label: "Unknown device" };

  const browser =
    /\bEdg\//.test(raw)
      ? "Edge"
      : /\bOPR\/|\bOpera\//.test(raw)
        ? "Opera"
        : /\bChrome\//.test(raw) && !/\bChromium\//.test(raw)
          ? "Chrome"
          : /\bFirefox\//.test(raw)
            ? "Firefox"
            : /\bSafari\//.test(raw) && !/\bChrome\//.test(raw)
              ? "Safari"
              : /\bMSIE\b|\bTrident\//.test(raw)
                ? "Internet Explorer"
                : null;

  const platform = /\bAndroid\b/i.test(raw)
    ? "Android"
    : /\biPhone\b|\biPad\b|\biPod\b/i.test(raw)
      ? "iOS"
      : /\bMac OS X\b|\bMacintosh\b/i.test(raw)
        ? "macOS"
        : /\bWindows\b/i.test(raw)
          ? "Windows"
          : /\bLinux\b/i.test(raw)
            ? "Linux"
            : null;

  const formFactor = /\bMobile\b|\biPhone\b|\bAndroid\b/i.test(raw)
    ? "mobile"
    : /\biPad\b|Tablet/i.test(raw)
      ? "tablet"
      : "desktop";

  if (browser && platform) return { label: `${browser} on ${platform}` };
  if (browser) return { label: `${browser} / ${formFactor}` };
  if (platform) return { label: `${platform} / ${formFactor}` };

  const short = raw.length > 72 ? `${raw.slice(0, 69)}…` : raw;
  return { label: "Unrecognized client", detail: short };
}

export function formatSessionWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
