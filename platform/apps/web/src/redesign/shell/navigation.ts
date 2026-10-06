import type { Session } from "../../api";
import { appPath, stripAppBase } from "../../appBase";
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
  const canProgram = capabilities.includes("program:read");
  const canExport = capabilities.includes("export:request");
  const canSettings = capabilities.includes("settings:read");

  if (!canOperate) {
    const systemItems: ShellNavItem[] = [];
    if (canExport) systemItems.push({ label: "Export", to: appPath("/exports"), icon: "transfer" });
    if (canSettings) systemItems.push({ label: "Settings", to: appPath("/settings"), icon: "settings" });
    return [
      ...(canProgram ? [{
        label: "Program",
        items: [{ label: "The Ryva Program", to: appPath("/program"), icon: "access" }]
      } satisfies ShellNavGroup] : []),
      ...(!canProgram ? [{
        label: "Access",
        items: [{ label: "Product access", to: appPath("/access"), icon: "access" }]
      } satisfies ShellNavGroup] : []),
      ...(systemItems.length ? [{ label: "System", items: systemItems }] : [])
    ];
  }

  return [
    ...(canProgram ? [{
      label: "Learn",
      items: [{ label: "The Ryva Program", to: appPath("/program"), icon: "access" }]
    } satisfies ShellNavGroup] : []),
    {
      label: "Operate",
      items: [
        { label: "Home", to: appPath("/"), icon: "home", exact: true },
        { label: "Tasks", to: appPath("/tasks"), icon: "tasks" },
        { label: "Representation", to: appPath("/representation"), icon: "agreement" },
        { label: "Placements", to: appPath("/placements"), icon: "placement" },
        { label: "Outreach", to: appPath("/outreach"), icon: "outreach" }
      ]
    },
    {
      label: "Intelligence",
      items: [
        { label: "Products", to: appPath("/products"), icon: "product" },
        { label: "Brands", to: appPath("/brands"), icon: "brand" },
        { label: "Businesses & Buyers", to: appPath("/buyers"), icon: "buyers" },
        { label: "Sources", to: appPath("/sources"), icon: "sources" }
      ]
    },
    {
      label: "Commercial",
      items: [
        { label: "Accounts", to: appPath("/accounts"), icon: "accounts" },
        { label: "Orders", to: appPath("/orders"), icon: "orders" },
        { label: "Reorders", to: appPath("/reorders"), icon: "reorders" },
        { label: "Commissions", to: appPath("/commissions"), icon: "commissions" }
      ]
    },
    {
      label: "Analyze",
      items: [
        { label: "Analytics", to: appPath("/analytics"), icon: "analytics" }
      ]
    },
    {
      label: "System",
      items: [
        { label: "Documents", to: appPath("/documents"), icon: "documents" },
        {
          label: "Data transfer",
          to: appPath("/imports"),
          icon: "transfer",
          children: [
            { label: "Import", to: appPath("/imports"), icon: "import" },
            ...(canExport ? [{ label: "Export", to: appPath("/exports"), icon: "export" } satisfies ShellNavItem] : [])
          ]
        },
        ...(canSettings ? [{ label: "Settings", to: appPath("/settings"), icon: "settings" } satisfies ShellNavItem] : [])
      ]
    }
  ];
}

const routeLabels: Array<[string, string]> = [
  ["/commission-disputes", "Commission disputes"],
  ["/protected-accounts", "Protected accounts"],
  ["/representation", "Representation"],
  ["/program", "The Ryva Program"],
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
  ["/brands", "Brands"],
  ["/buyers", "Businesses & Buyers"],
  ["/orders", "Orders"],
  ["/tasks", "Tasks"],
  ["/sources", "Sources"],
  ["/copilot", "AI Copilot"],
  ["/admin", "Operations"],
  ["/access", "Access"],
  ["/login", "Sign in"]
];

export type MobileBottomNavItem = {
  label: string;
  to: string;
  icon: ShellIconName;
  exact?: boolean;
};

/** Primary mobile bottom destinations for full-access sessions. */
export const mobileBottomNavigation: MobileBottomNavItem[] = [
  { label: "Home", to: appPath("/"), icon: "home", exact: true },
  { label: "Tasks", to: appPath("/tasks"), icon: "tasks" },
  { label: "Placements", to: appPath("/placements"), icon: "placement" }
];

export function shellItemIsActive(item: ShellNavItem, pathname: string, search: string): boolean {
  const [itemPath, itemSearch = ""] = item.to.split("?");
  if (itemSearch) {
    return pathname === itemPath
      && new URLSearchParams(search).get("view") === new URLSearchParams(itemSearch).get("view");
  }
  return item.exact ? pathname === itemPath : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function shellRouteLabel(pathname: string): string {
  const relative = stripAppBase(pathname);
  if (relative === "/") return "Home";
  return routeLabels.find(([prefix]) => relative.startsWith(prefix))?.[1] ?? "Ryva Pro";
}

export function shellDocumentTitle(pathname: string, search = ""): string {
  const params = new URLSearchParams(search);
  const relative = stripAppBase(pathname);
  if (relative === "/analytics" && params.get("view") === "definitions") {
    return "Metric guide · Ryva Pro";
  }
  if (pathname === "/login") return "Sign in · Ryva";
  const label = shellRouteLabel(pathname);
  return label === "Ryva Pro" ? "Ryva Pro" : `${label} · Ryva Pro`;
}
