import type { Session } from "../../api";
import type { ShellIconName } from "./ShellIcon";

export type ShellNavItem = {
  label: string;
  to: string;
  icon: ShellIconName;
  exact?: boolean;
  children?: ShellNavItem[];
};

export type ShellNavGroup = {
  label: string;
  items: ShellNavItem[];
};

export function buildShellNavigation(session: Session): ShellNavGroup[] {
  const capabilities = session.access.capabilities;
  const canOperate = capabilities.includes("operational:read");
  const canExport = capabilities.includes("export:request");
  const canSettings = capabilities.includes("settings:read");

  if (!canOperate) {
    const systemItems: ShellNavItem[] = [];
    if (canExport) systemItems.push({ label: "Export", to: "/exports", icon: "transfer" });
    if (canSettings) systemItems.push({ label: "Settings", to: "/settings", icon: "settings" });
    return [
      {
        label: "Access",
        items: [{ label: "Access check", to: "/access", icon: "access" }]
      },
      ...(systemItems.length ? [{ label: "System", items: systemItems }] : [])
    ];
  }

  return [
    {
      label: "Operate",
      items: [
        { label: "Home", to: "/", icon: "home", exact: true },
        { label: "Tasks", to: "/tasks", icon: "tasks" },
        { label: "Representation", to: "/representation", icon: "agreement" },
        { label: "Placements", to: "/placements", icon: "placement" },
        { label: "Outreach", to: "/outreach", icon: "outreach" }
      ]
    },
    {
      label: "Intelligence",
      items: [
        { label: "Products", to: "/products", icon: "product" },
        { label: "Brands", to: "/brands", icon: "brand" },
        { label: "Businesses & Buyers", to: "/buyers", icon: "buyers" }
      ]
    },
    {
      label: "Commercial",
      items: [
        { label: "Accounts", to: "/accounts", icon: "accounts" },
        { label: "Orders", to: "/orders", icon: "orders" },
        { label: "Reorders", to: "/reorders", icon: "reorders" },
        { label: "Commissions", to: "/commissions", icon: "commissions" }
      ]
    },
    {
      label: "Analyze",
      items: [
        { label: "Analytics", to: "/analytics", icon: "analytics" },
        { label: "Reports", to: "/analytics?view=reports", icon: "reports" }
      ]
    },
    {
      label: "System",
      items: [
        { label: "Documents", to: "/documents", icon: "documents" },
        {
          label: "Data transfer",
          to: "/imports",
          icon: "transfer",
          children: [
            { label: "Import", to: "/imports", icon: "import" },
            ...(canExport ? [{ label: "Export", to: "/exports", icon: "export" } satisfies ShellNavItem] : [])
          ]
        },
        ...(canSettings ? [{ label: "Settings", to: "/settings", icon: "settings" } satisfies ShellNavItem] : [])
      ]
    }
  ];
}

const routeLabels: Array<[string, string]> = [
  ["/commission-disputes", "Commission disputes"],
  ["/protected-accounts", "Protected accounts"],
  ["/representation", "Representation"],
  ["/certification", "Certification"],
  ["/subscription", "Subscription"],
  ["/notifications", "Notifications"],
  ["/agreements", "Agreement"],
  ["/commissions", "Commissions"],
  ["/placements", "Placements"],
  ["/documents", "Documents"],
  ["/analytics", "Analytics"],
  ["/products", "Products"],
  ["/accounts", "Accounts"],
  ["/outreach", "Outreach"],
  ["/reorders", "Reorders"],
  ["/records/contact", "Contacts"],
  ["/contacts", "Contact"],
  ["/territories", "Territories"],
  ["/imports", "Data import"],
  ["/exports", "Data export"],
  ["/settings", "Settings"],
  ["/profile", "Profile"],
  ["/search", "Search"],
  ["/brands", "Brands"],
  ["/buyers", "Businesses & Buyers"],
  ["/orders", "Orders"],
  ["/tasks", "Tasks"],
  ["/sources", "Sources"],
  ["/copilot", "AI Copilot"],
  ["/admin", "Operations"],
  ["/access", "Access"]
];

export function shellRouteLabel(pathname: string): string {
  if (pathname === "/") return "Home";
  return routeLabels.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "Ryva Pro";
}
