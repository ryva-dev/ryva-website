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
  outreach: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  placement: ["M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z", "M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4"],
  product: ["m12 3 9 5-9 5-9-5 9-5Z", "m3 8 9 5 9-5M3 8v8l9 5 9-5V8M12 13v8"],
  profile: ["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10"],
  reorders: ["M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", "M3 21v-5h5"],
  reports: ["M5 3h14v18H5z", "M8 16v-3M12 16V8M16 16v-5"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16", "m21 21-4.4-4.4"],
  settings: [
    "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6"
  ],
  tasks: ["M9 11l3 3L22 4", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],
  transfer: ["M7 7h11m-3-3 3 3-3 3M17 17H6m3 3-3-3 3-3"]
};

export function ShellIcon({ name }: { name: ShellIconName }) {
  return (
    <svg className="ry-shell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name].map((path) => <path d={path} key={path} />)}
    </svg>
  );
}
