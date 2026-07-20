export type ShellIconName =
  | "access"
  | "accounts"
  | "agreement"
  | "analytics"
  | "brand"
  | "buyers"
  | "chevron"
  | "close"
  | "collapse"
  | "commissions"
  | "documents"
  | "export"
  | "home"
  | "import"
  | "menu"
  | "notifications"
  | "orders"
  | "outreach"
  | "placement"
  | "product"
  | "profile"
  | "reorders"
  | "reports"
  | "search"
  | "settings"
  | "tasks"
  | "transfer";

const paths: Record<ShellIconName, string[]> = {
  access: ["M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z", "m9 12 2 2 4-4"],
  accounts: ["M4 6h16v13H4z", "M8 6V4h8v2", "M4 10h16"],
  agreement: ["M6 3h9l3 3v15H6z", "M9 9h6M9 13h6M9 17h4"],
  analytics: ["M4 19V9M10 19V5M16 19v-7M22 19V3"],
  brand: ["M5 4h14v16H5z", "M9 8h6M9 12h6M9 16h3"],
  buyers: ["M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8"],
  chevron: ["m9 18 6-6-6-6"],
  close: ["M6 6l12 12M18 6 6 18"],
  collapse: ["M4 4h16v16H4z", "m13 8-4 4 4 4"],
  commissions: ["M12 2v20M17 6.5C16 5 14.3 4 12 4c-3 0-5 1.5-5 3.5 0 5 10 2.5 10 8 0 2-2 3.5-5 3.5-2.3 0-4-1-5-2.5"],
  documents: ["M6 3h9l3 3v15H6z", "M9 11h6M9 15h6"],
  export: ["M12 3v12M7 8l5-5 5 5", "M5 14v6h14v-6"],
  home: ["m3 11 9-8 9 8", "M5 10v10h14V10", "M9 20v-6h6v6"],
  import: ["M12 15V3M7 10l5 5 5-5", "M5 14v6h14v-6"],
  menu: ["M4 7h16M4 12h16M4 17h16"],
  notifications: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
  orders: ["M5 3h14v18H5z", "M9 7h6M9 11h6M9 15h4"],
  outreach: ["m3 11 18-8-8 18-2-8-8-2Z", "m11 2-3 11"],
  placement: ["M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z", "M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4"],
  product: ["m12 3 9 5-9 5-9-5 9-5Z", "m3 8 9 5 9-5M3 8v8l9 5 9-5V8M12 13v8"],
  profile: ["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10"],
  reorders: ["M20 7h-5V2", "M20 7a9 9 0 1 0 2 6M4 17h5v5", "M4 17a9 9 0 0 0 15-2"],
  reports: ["M5 3h14v18H5z", "M8 16v-3M12 16V8M16 16v-5"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16", "m21 21-4.4-4.4"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7", "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.8-.2l-.6.3a1.7 1.7 0 0 0-1 1.5v.1h-4v-.1a1.7 1.7 0 0 0-1-1.5l-.6-.3a1.7 1.7 0 0 0-1.8.2l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 5 15v-.7a1.7 1.7 0 0 0-1-1.5H4V9h.1a1.7 1.7 0 0 0 1-1.5V7a1.7 1.7 0 0 0-.3-1.9L4.7 5l2-3.4.2.1a1.7 1.7 0 0 0 1.8.2l.6-.3a1.7 1.7 0 0 0 1-1.5V0h4v.1a1.7 1.7 0 0 0 1 1.5l.6.3a1.7 1.7 0 0 0 1.8-.2l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9l.3.6a1.7 1.7 0 0 0 1.5 1H22v4h-.1a1.7 1.7 0 0 0-1.5 1l-.3.6a1.7 1.7 0 0 0-.7.8Z"],
  tasks: ["M5 4h14v16H5z", "m8 9 2 2 4-4M8 15h8"],
  transfer: ["M7 7h11m-3-3 3 3-3 3M17 17H6m3 3-3-3 3-3"]
};

export function ShellIcon({ name }: { name: ShellIconName }) {
  return (
    <svg className="ry-shell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name].map((path) => <path d={path} key={path} />)}
    </svg>
  );
}
