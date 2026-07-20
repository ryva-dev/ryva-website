export const designTokens = {
  typography: {
    family: {
      sans: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    },
    size: {
      11: "0.6875rem",
      12: "0.75rem",
      13: "0.8125rem",
      14: "0.875rem",
      16: "1rem",
      18: "1.125rem",
      20: "1.25rem",
      24: "1.5rem",
      30: "1.875rem",
      36: "2.25rem"
    },
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: {
      16: "1rem",
      18: "1.125rem",
      20: "1.25rem",
      24: "1.5rem",
      26: "1.625rem",
      28: "1.75rem",
      32: "2rem",
      38: "2.375rem",
      44: "2.75rem"
    },
    letterSpacing: { tight: "-0.01em", normal: "0", wide: "0.08em" }
  },
  space: {
    0: "0",
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.5rem",
    6: "2rem",
    7: "2.5rem",
    8: "3rem",
    9: "4rem"
  },
  size: {
    0: "0",
    1: "0.125rem",
    2: "0.25rem",
    3: "0.5rem",
    4: "0.75rem",
    5: "1rem",
    6: "1.25rem",
    7: "1.5rem",
    8: "2rem",
    9: "2.5rem",
    10: "3rem",
    11: "4rem"
  },
  width: {
    sidebarExpanded: "15rem",
    sidebarCollapsed: "4.5rem",
    drawerNarrow: "25rem",
    drawerStandard: "32.5rem",
    drawerWide: "42.5rem",
    contextRail: "20rem",
    reading: "45rem",
    consequential: "60rem",
    workspaceMax: "90rem"
  },
  radius: {
    0: "0",
    1: "0.25rem",
    2: "0.375rem",
    3: "0.5rem",
    4: "0.75rem",
    pill: "999px"
  },
  color: {
    white: "#ffffff",
    black: "#000000",
    surfaceCanvas: "#f6f7f5",
    surface: "#ffffff",
    surfaceSubtle: "#f0f3f0",
    surfaceHover: "#eaeeeb",
    surfaceSelected: "#e5efec",
    surfaceDisabled: "#e7ebe8",
    textStrong: "#17211f",
    textDefault: "#2f3a37",
    textMuted: "#5e6b67",
    textSubtle: "#74807c",
    textDisabled: "#56635f",
    textOnAccent: "#ffffff",
    textOnDark: "#f7faf8",
    border: "#dce2de",
    borderStrong: "#c5cec8",
    accent: "#285b52",
    accentHover: "#214c45",
    accentPressed: "#1a403a",
    accentSubtle: "#e4efec",
    accentText: "#1f5048",
    success: "#287652",
    successBackground: "#e8f4ed",
    warning: "#8a6116",
    warningBackground: "#fff4d6",
    danger: "#a83c3c",
    dangerBackground: "#fbeaea",
    info: "#365f88",
    infoBackground: "#eaf1f8",
    neutralState: "#56625e",
    neutralStateBackground: "#eef1ef",
    ai: "#53618b",
    aiBackground: "#edf0f8",
    chartSlate: "#5f6d69",
    chartBlue: "#58738d",
    chartAmber: "#9a7440",
    chartPlum: "#76647a",
    focus: "#3b6e65"
  },
  border: { width0: "0", width1: "1px" },
  elevation: {
    0: "none",
    1: "0 1px 2px rgb(23 33 31 / 6%)",
    menu: "0 8px 24px rgb(23 33 31 / 10%)",
    dialog: "0 16px 48px rgb(23 33 31 / 16%)"
  },
  icon: { small: "0.875rem", default: "1.125rem", large: "1.25rem", strokeWidth: 1.75 },
  control: {
    compact: "2rem",
    default: "2.5rem",
    touch: "2.75rem",
    tableHeader: "2.5rem",
    tableRowCompact: "2.5rem",
    tableRowDefault: "3rem"
  },
  motion: {
    instant: "1ms",
    fast: "120ms",
    standard: "180ms",
    slow: "240ms",
    easingStandard: "cubic-bezier(0.2, 0, 0, 1)",
    easingExit: "cubic-bezier(0.4, 0, 1, 1)"
  },
  focusRing: "0 0 0 2px #ffffff, 0 0 0 4px #3b6e65",
  zIndex: {
    base: 0,
    sticky: 100,
    dropdown: 300,
    overlay: 400,
    drawer: 500,
    modal: 600,
    toast: 700,
    tooltip: 800,
    skipLink: 900
  },
  breakpoint: { mobile: 768, desktop: 1024, wide: 1440 }
} as const;

export type DesignTokens = typeof designTokens;
export type Breakpoint = keyof DesignTokens["breakpoint"];
