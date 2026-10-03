import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { appPath, stripAppBase } from "../../appBase";
import { useAuth } from "../../auth";
import { buildShellNavigation, mobileBottomNavigation, shellDocumentTitle, shellItemIsActive, shellRouteLabel, type ShellNavGroup, type ShellNavItem } from "./navigation";
import { Banner, LoadingState, StatusLabel } from "../../design-system";
import { designTokens } from "../../design/tokens";
import { ShellIcon, type ShellIconName } from "./ShellIcon";
import { WorkspaceSearch } from "./WorkspaceSearch";

type ViewportMode = "mobile" | "tablet" | "desktop";
type ShellNotification = {
  id: string;
  title: string;
  reason: string;
  severity: string;
  status: string;
  blocking: boolean;
  subjectType: string;
  subjectId: string;
  lastOccurredAt: string;
};

function currentViewport(): ViewportMode {
  if (typeof window === "undefined") return "desktop";
  if (window.innerWidth <= designTokens.breakpoint.mobile) return "mobile";
  if (window.innerWidth <= designTokens.breakpoint.desktop) return "tablet";
  return "desktop";
}

function initials(name: string, email?: string): string {
  const fromName = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  if (fromName) return fromName;
  const local = email?.split("@")[0]?.trim() ?? "";
  if (local) return local.slice(0, 2).toUpperCase();
  return "R";
}

function notificationPath(item: ShellNotification): string {
  const routes: Record<string, string> = {
    placement_opportunity: appPath("/placements"),
    representation_opportunity: appPath("/representation"),
    order: appPath("/orders"),
    commission: appPath("/commissions"),
    commission_dispute: appPath("/commission-disputes"),
    protected_account: appPath("/protected-accounts"),
    task: appPath("/tasks"),
    outreach_message: appPath("/outreach"),
    brand: appPath("/brands"),
    business: appPath("/buyers"),
    product: appPath("/products")
  };
  const root = routes[item.subjectType];
  return root ? `${root}/${item.subjectId}` : appPath(`/records/${item.subjectType}/${item.subjectId}`);
}

function severityRank(severity: string): number {
  return ({ critical: 1, action_required: 2, time_sensitive: 3, information: 4 } as Record<string, number>)[severity] ?? 5;
}

function sortShellNotifications(items: ShellNotification[]): ShellNotification[] {
  return [...items].sort((left, right) => {
    const unreadDelta = Number(right.status === "unread") - Number(left.status === "unread");
    if (unreadDelta) return unreadDelta;
    const severityDelta = severityRank(left.severity) - severityRank(right.severity);
    if (severityDelta) return severityDelta;
    return new Date(right.lastOccurredAt).getTime() - new Date(left.lastOccurredAt).getTime();
  });
}

function ShellLink({
  item,
  collapsed,
  pathname,
  search,
  onNavigate
}: {
  item: ShellNavItem;
  collapsed: boolean;
  pathname: string;
  search: string;
  onNavigate: () => void;
}) {
  const active = shellItemIsActive(item, pathname, search);
  return (
    <Link
      to={item.to}
      className={active ? "ry-shell-link active" : "ry-shell-link"}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      data-tooltip={collapsed ? item.label : undefined}
      onClick={onNavigate}
    >
      <ShellIcon name={item.icon} />
      <span className="ry-shell-link-label">{item.label}</span>
    </Link>
  );
}

function NavigationGroups({
  groups,
  collapsed,
  pathname,
  search,
  idPrefix,
  onNavigate
}: {
  groups: ShellNavGroup[];
  collapsed: boolean;
  pathname: string;
  search: string;
  idPrefix: string;
  onNavigate: () => void;
}) {
  return (
    <nav className="ry-shell-navigation" aria-label="Primary">
      {groups.map((group) => (
        <section className="ry-shell-nav-group" aria-labelledby={`${idPrefix}-${group.label.replaceAll(" ", "-").toLowerCase()}`} key={group.label}>
          <h2 id={`${idPrefix}-${group.label.replaceAll(" ", "-").toLowerCase()}`}>{group.label}</h2>
          <div>
            {group.items.map((item) => item.children ? (
              <details className="ry-shell-nested" key={item.label}>
                <summary
                  role="button"
                  aria-label={collapsed ? item.label : undefined}
                  data-tooltip={collapsed ? item.label : undefined}
                >
                  <ShellIcon name={item.icon} />
                  <span className="ry-shell-link-label">{item.label}</span>
                  <ShellIcon name="chevron" />
                </summary>
                <div className="ry-shell-nested-items">
                  {item.children.map((child) => (
                    <ShellLink
                      item={child}
                      collapsed={false}
                      pathname={pathname}
                      search={search}
                      onNavigate={onNavigate}
                      key={child.to}
                    />
                  ))}
                </div>
              </details>
            ) : (
              <ShellLink
                item={item}
                collapsed={collapsed}
                pathname={pathname}
                search={search}
                onNavigate={onNavigate}
                key={item.to}
              />
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}

function NotificationsMenu({
  unreadCount,
  canWrite,
  variant,
  collapsed = false,
  onUnreadChange,
  onNavigate
}: {
  unreadCount: number;
  canWrite: boolean;
  variant: "toolbar" | "sidebar" | "mobile";
  collapsed?: boolean;
  onUnreadChange: (count: number) => void;
  onNavigate?: () => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [items, setItems] = useState<ShellNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState("");

  function closeAndFocus() {
    const details = detailsRef.current;
    if (!details) return;
    details.open = false;
    details.querySelector("summary")?.focus();
  }

  async function loadNotifications() {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ notifications: ShellNotification[] }>("/api/notifications");
      const sorted = sortShellNotifications(result.notifications);
      setItems(sorted);
      onUnreadChange(sorted.filter((item) => item.status === "unread").length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Notifications could not be loaded.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(item: ShellNotification) {
    if (!canWrite || item.status !== "unread") return;
    setMarkingId(item.id);
    setError("");
    try {
      await api(`/api/notifications/${item.id}`, { method: "PATCH", body: { status: "read" } });
      setItems((current) => {
        const next = current.map((entry) => entry.id === item.id ? { ...entry, status: "read" } : entry);
        onUnreadChange(next.filter((entry) => entry.status === "unread").length);
        return next;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Notification could not be updated.");
    } finally {
      setMarkingId("");
    }
  }

  const preview = items.slice(0, 8);
  const countLabel = unreadCount ? `${unreadCount > 99 ? "99+" : unreadCount} unread` : "";

  return (
    <details
      className={`ry-notifications-menu ry-notifications-menu-${variant}`}
      ref={detailsRef}
      onToggle={(event) => {
        if (event.currentTarget.open) void loadNotifications();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeAndFocus();
        }
      }}
    >
      <summary
        className={variant === "sidebar" ? "ry-shell-utility-link" : "ry-shell-icon-button"}
        role="button"
        aria-label={`Notifications${countLabel ? `, ${countLabel}` : ""}`}
        data-tooltip={collapsed ? "Notifications" : undefined}
      >
        <ShellIcon name="notifications" />
        {variant === "sidebar" ? <span className="ry-shell-link-label">Notifications</span> : null}
        {unreadCount ? (
          <span className="ry-notification-count" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </summary>
      <div className="ry-notifications-popover" role="menu" aria-label="Notifications">
        <header>
          <strong>Notifications</strong>
          <small>{unreadCount ? `${unreadCount} unread` : "You're caught up"}</small>
        </header>
        {loading ? <p className="ry-notifications-empty">Loading…</p> : null}
        {error ? <p className="ry-notifications-error" role="alert">{error}</p> : null}
        {!loading && !error && preview.length === 0 ? (
          <p className="ry-notifications-empty">No notifications yet.</p>
        ) : null}
        {!loading && preview.length > 0 ? (
          <ul className="ry-notifications-list">
            {preview.map((item) => (
              <li key={item.id} className={item.status === "unread" ? "is-unread" : undefined}>
                <Link
                  to={notificationPath(item)}
                  role="menuitem"
                  onClick={() => {
                    closeAndFocus();
                    onNavigate?.();
                  }}
                >
                  <span className="ry-notifications-item-title">{item.title}</span>
                  <span className="ry-notifications-item-reason">{item.reason}</span>
                  <span className="ry-notifications-item-meta">
                    {item.blocking ? "Blocking · " : ""}
                    {new Date(item.lastOccurredAt).toLocaleString()}
                  </span>
                </Link>
                {item.status === "unread" && canWrite ? (
                  <button
                    type="button"
                    className="ry-notifications-mark"
                    disabled={markingId === item.id}
                    onClick={() => void markRead(item)}
                  >
                    Mark read
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <footer>
          <Link
            to={appPath("/notifications")}
            onClick={() => {
              closeAndFocus();
              onNavigate?.();
            }}
          >
            Open notification center
          </Link>
        </footer>
      </div>
    </details>
  );
}

function ProfileMenu({
  name,
  email,
  role,
  programStatus,
  proAccessState,
  canAccessProgram,
  collapsed,
  canProfile,
  canSettings,
  onLogout
}: {
  name: string;
  email: string;
  role: string;
  programStatus: string | null;
  proAccessState: string;
  canAccessProgram: boolean;
  collapsed: boolean;
  canProfile: boolean;
  canSettings: boolean;
  onLogout: () => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  function closeAndFocus() {
    const details = detailsRef.current;
    if (!details) return;
    details.open = false;
    details.querySelector("summary")?.focus();
  }
  return (
    <details
      className="ry-profile-menu"
      ref={detailsRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeAndFocus();
        }
      }}
    >
      <summary role="button" aria-label={`Profile: ${name}`} data-tooltip={collapsed ? "Profile" : undefined}>
        <span className="ry-profile-initials" aria-hidden="true">{initials(name, email)}</span>
        <span className="ry-profile-summary">
          <strong>{name}</strong>
          <small>{["trial_active", "subscription_active", "paid_through", "staff"].includes(proAccessState) ? role : "Review access status"}</small>
        </span>
        <ShellIcon name="chevron" />
      </summary>
      <div className="ry-profile-popover">
        <header>
          <strong>{name}</strong>
          <small>Ryva workspace · {role}</small>
        </header>
        <div className="ry-profile-statuses">
          <span>Program <StatusLabel value={programStatus ?? "not_active"} /></span>
          <span>Ryva Pro <StatusLabel value={proAccessState} /></span>
        </div>
        <nav aria-label="Profile and access">
          {canProfile ? <Link to={appPath("/profile")} onClick={closeAndFocus}>Profile</Link> : null}
          {canAccessProgram ? <Link to={appPath("/program")} onClick={closeAndFocus}>The Ryva Program</Link> : null}
          <Link to={appPath("/access")} onClick={closeAndFocus}>Product access</Link>
          <Link to={appPath("/subscription")} onClick={closeAndFocus}>Subscription</Link>
          {canSettings ? <Link to={appPath("/settings")} onClick={closeAndFocus}>Settings</Link> : null}
        </nav>
        <button className="text-button" type="button" onClick={onLogout}>Sign out</button>
      </div>
    </details>
  );
}

function MobileMoreMenu({
  open,
  groups,
  currentPath,
  currentSearch,
  name,
  email,
  role,
  programStatus,
  proAccessState,
  subscriptionStatus,
  canAccessProgram,
  canProfile,
  canSettings,
  unreadCount,
  isAdmin,
  onClose,
  onLogout
}: {
  open: boolean;
  groups: ShellNavGroup[];
  currentPath: string;
  currentSearch: string;
  name: string;
  email: string;
  role: string;
  programStatus: string | null;
  proAccessState: string;
  subscriptionStatus: string | null;
  canAccessProgram: boolean;
  canProfile: boolean;
  canSettings: boolean;
  unreadCount: number;
  isAdmin: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
      ) ?? []
    ).filter((element) => !element.hasAttribute("disabled"));
    if (!focusable.length) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;
  return (
    <div className="ry-mobile-menu-layer">
      <button className="ry-mobile-menu-scrim" type="button" onClick={onClose} aria-label="Close navigation menu" />
      <div
        className="ry-mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-menu-title"
        ref={dialogRef}
        onKeyDown={handleKeys}
      >
        <header>
          <div>
            <p className="eyebrow">Current location</p>
            <h2 id="mobile-menu-title">{shellRouteLabel(currentPath)}</h2>
          </div>
          <button className="ry-shell-icon-button" type="button" onClick={onClose} aria-label="Close navigation menu" ref={closeRef}>
            <ShellIcon name="close" />
          </button>
        </header>
        <div className="ry-mobile-menu-scroll">
          <NavigationGroups
            groups={groups}
            collapsed={false}
            pathname={currentPath}
            search={currentSearch}
            idPrefix="mobile-nav"
            onNavigate={onClose}
          />
          {isAdmin ? (
            <section className="ry-shell-admin">
              <h2>Administrative</h2>
              <ShellLink
                item={{ label: "Operations", to: "/admin", icon: "settings" }}
                collapsed={false}
                pathname={currentPath}
                search={currentSearch}
                onNavigate={onClose}
              />
            </section>
          ) : null}
          <section className="ry-mobile-utilities" aria-labelledby="mobile-account-title">
            <h2 id="mobile-account-title">Account</h2>
            <Link to={appPath("/notifications")} onClick={onClose}>
              <ShellIcon name="notifications" />
              <span>Notifications</span>
              {unreadCount ? <span className="ry-notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
            </Link>
            {canProfile ? <Link to={appPath("/profile")} onClick={onClose}><ShellIcon name="profile" /><span>Profile</span></Link> : null}
            {canAccessProgram ? <Link to={appPath("/program")} onClick={onClose}><ShellIcon name="access" /><span>The Ryva Program</span><StatusLabel value={programStatus ?? "not_active"} /></Link> : null}
            <Link to={appPath("/subscription")} onClick={onClose}><ShellIcon name="accounts" /><span>Subscription</span><StatusLabel value={subscriptionStatus ?? "not_active"} /></Link>
            <Link to={appPath("/access")} onClick={onClose}><ShellIcon name="access" /><span>Access</span><StatusLabel value={proAccessState} /></Link>
            {canSettings ? <Link to={appPath("/settings")} onClick={onClose}><ShellIcon name="settings" /><span>Settings</span></Link> : null}
          </section>
          <footer>
            <span className="ry-profile-initials" aria-hidden="true">{initials(name, email)}</span>
            <span><strong>{name}</strong><small>{role}</small></span>
            <button className="text-button" type="button" onClick={onLogout}>Sign out</button>
          </footer>
        </div>
      </div>
    </div>
  );
}

function BottomNavLink({
  to,
  label,
  icon,
  currentPath,
  exact = false
}: {
  to: string;
  label: string;
  icon: ShellIconName;
  currentPath: string;
  exact?: boolean;
}) {
  const active = exact ? currentPath === to : currentPath === to || currentPath.startsWith(`${to}/`);
  return (
    <Link to={to} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
      <ShellIcon name={icon} />
      <span>{label}</span>
    </Link>
  );
}

function ShellBrand({ destination }: { destination: string }) {
  return (
    <Link className="ry-shell-brand" to={destination} aria-label="Ryva Pro home">
      <span className="ry-shell-wordmark">ryva</span>
    </Link>
  );
}

function DesktopSidebar({
  groups,
  collapsed,
  tabletOpen,
  viewport,
  pathname,
  search,
  canOperate,
  unreadCount,
  canWriteNotifications,
  isAdmin,
  userName,
  userEmail,
  userRole,
  programStatus,
  proAccessState,
  canAccessProgram,
  canProfile,
  canSettings,
  onToggle,
  onNavigate,
  onLogout,
  onUnreadChange
}: {
  groups: ShellNavGroup[];
  collapsed: boolean;
  tabletOpen: boolean;
  viewport: ViewportMode;
  pathname: string;
  search: string;
  canOperate: boolean;
  unreadCount: number;
  canWriteNotifications: boolean;
  isAdmin: boolean;
  userName: string;
  userEmail: string;
  userRole: string;
  programStatus: string | null;
  proAccessState: string;
  canAccessProgram: boolean;
  canProfile: boolean;
  canSettings: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  onLogout: () => void;
  onUnreadChange: (count: number) => void;
}) {
  const visuallyCollapsed = viewport === "tablet" ? !tabletOpen : collapsed;
  return (
    <>
      {tabletOpen ? <button className="ry-tablet-scrim" type="button" onClick={onToggle} aria-label="Close navigation" /> : null}
      <aside className="ry-sidebar" aria-label="Ryva application">
        <header>
          <ShellBrand destination={canOperate ? appPath("/") : canAccessProgram ? appPath("/program") : appPath("/access")} />
          <button
            className="ry-shell-icon-button ry-collapse-button"
            type="button"
            aria-label={visuallyCollapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!visuallyCollapsed}
            onClick={onToggle}
          >
            <ShellIcon name="collapse" />
          </button>
        </header>
        <div className="ry-sidebar-scroll">
          <NavigationGroups
            groups={groups}
            collapsed={visuallyCollapsed}
            pathname={pathname}
            search={search}
            idPrefix="desktop-nav"
            onNavigate={onNavigate}
          />
          {isAdmin ? (
            <section className="ry-shell-admin">
              <h2>Administrative</h2>
              <ShellLink
                item={{ label: "Operations", to: "/admin", icon: "settings" }}
                collapsed={visuallyCollapsed}
                pathname={pathname}
                search={search}
                onNavigate={onNavigate}
              />
            </section>
          ) : null}
        </div>
        <footer className="ry-sidebar-footer">
          {canOperate ? (
            <NotificationsMenu
              variant="sidebar"
              unreadCount={unreadCount}
              canWrite={canWriteNotifications}
              collapsed={visuallyCollapsed}
              onUnreadChange={onUnreadChange}
              onNavigate={onNavigate}
            />
          ) : null}
          <ProfileMenu
            name={userName}
            email={userEmail}
            role={userRole}
            programStatus={programStatus}
            proAccessState={proAccessState}
            canAccessProgram={canAccessProgram}
            collapsed={visuallyCollapsed}
            canProfile={canProfile}
            canSettings={canSettings}
            onLogout={onLogout}
          />
        </footer>
      </aside>
    </>
  );
}

export function ApplicationShell() {
  const { session, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [viewport, setViewport] = useState<ViewportMode>(currentViewport);
  const [collapsed, setCollapsed] = useState(false);
  const [tabletOpen, setTabletOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onResize = () => setViewport(currentViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!session) return;
    const saved = window.localStorage.getItem(`ryva.sidebar.${session.user.id}`);
    setCollapsed(saved === "collapsed");
  }, [session]);

  useEffect(() => {
    setTabletOpen(false);
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.title = shellDocumentTitle(location.pathname, location.search);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (viewport !== "tablet") setTabletOpen(false);
    if (viewport !== "mobile") setMobileOpen(false);
  }, [viewport]);

  useEffect(() => {
    if (!session?.access.capabilities.includes("operational:read")) {
      setUnreadCount(0);
      return;
    }
    let active = true;
    void api<{ notifications: ShellNotification[] }>("/api/notifications")
      .then((result) => {
        if (active) setUnreadCount(result.notifications.filter((item) => item.status === "unread").length);
      })
      .catch(() => {
        if (active) setUnreadCount(0);
      });
    return () => {
      active = false;
    };
  }, [session]);

  if (loading) return <LoadingState label="Checking secure access" />;
  if (!session) return <Navigate to="/login" replace />;

  const canOperate = session.access.capabilities.includes("operational:read");
  const canAccessProgram = session.access.capabilities.includes("program:read");
  const canWriteNotifications = session.access.capabilities.includes("operational:write");
  const canProfile = session.access.capabilities.includes("profile:read");
  const canSettings = session.access.capabilities.includes("settings:read");
  const isAdmin = session.user.role === "admin";
  const relativePath = stripAppBase(location.pathname);
  const accountRoute = ["/access", "/profile", "/settings", "/subscription"].some(
    (path) => relativePath === path || relativePath.startsWith(`${path}/`)
  );
  const programRoute = relativePath === "/program" || relativePath.startsWith("/program/");
  const staffRoute = ["admin", "support"].includes(session.user.role) && (
    relativePath === "/certification" || (session.user.role === "admin" && relativePath === "/admin")
  );
  if (!canOperate && !accountRoute && !programRoute && !staffRoute) {
    return <Navigate to={session.access.canAccessProgram ? appPath("/program") : appPath("/access")} replace />;
  }
  const groups = buildShellNavigation(session);
  const shellCollapsed = viewport === "tablet"
    ? !tabletOpen
    : viewport === "desktop"
      ? collapsed
      : false;
  const userId = session.user.id;

  function setUnreadFromMenu(count: number) {
    setUnreadCount(count);
  }

  function toggleSidebar() {
    if (viewport === "tablet") {
      setTabletOpen((current) => !current);
      return;
    }
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(`ryva.sidebar.${userId}`, next ? "collapsed" : "expanded");
      return next;
    });
  }

  function closeNavigation() {
    setTabletOpen(false);
  }

  function closeMobileMenu() {
    setMobileOpen(false);
    window.requestAnimationFrame(() => moreButtonRef.current?.focus());
  }

  function signOut() {
    void logout().then(() => navigate("/login"));
  }

  const accessTone = session.access.mode === "blocked" || session.access.mode === "restricted" ? "danger" : "warning";

  return (
    <div
      className={[
        "ry-shell",
        shellCollapsed ? "ry-shell-collapsed" : "",
        tabletOpen ? "ry-shell-tablet-open" : ""
      ].filter(Boolean).join(" ")}
    >
      <DesktopSidebar
        groups={groups}
        collapsed={collapsed}
        tabletOpen={tabletOpen}
        viewport={viewport}
        pathname={location.pathname}
        search={location.search}
        canOperate={canOperate}
        unreadCount={unreadCount}
        canWriteNotifications={canWriteNotifications}
        isAdmin={isAdmin}
        userName={session.user.name}
        userEmail={session.user.email}
        userRole={session.user.role}
        programStatus={session.access.programStatus}
        proAccessState={session.access.proAccessState}
        canAccessProgram={canAccessProgram}
        canProfile={canProfile}
        canSettings={canSettings}
        onToggle={toggleSidebar}
        onNavigate={closeNavigation}
        onLogout={signOut}
        onUnreadChange={setUnreadFromMenu}
      />

      <header className="ry-mobile-topbar">
        <ShellBrand destination={canOperate ? appPath("/") : session.access.canAccessProgram ? appPath("/program") : appPath("/access")} />
        <strong>{shellRouteLabel(location.pathname)}</strong>
        {canOperate ? (
          <NotificationsMenu
            variant="mobile"
            unreadCount={unreadCount}
            canWrite={canWriteNotifications}
            onUnreadChange={setUnreadFromMenu}
          />
        ) : <span />}
      </header>

      <main id="main-content" className="ry-shell-canvas">
        {canOperate && viewport === "desktop" ? (
          <div className="ry-workspace-topbar">
            <WorkspaceSearch />
            <div className="ry-workspace-actions">
              <NotificationsMenu
                variant="toolbar"
                unreadCount={unreadCount}
                canWrite={canWriteNotifications}
                onUnreadChange={setUnreadFromMenu}
              />
            </div>
          </div>
        ) : null}
        {session.access.mode !== "full" && !location.pathname.startsWith(appPath("/program")) ? (
          <Banner tone={accessTone} title={session.access.mode.replaceAll("_", " ")}>
            {session.access.reason.replaceAll("_", " ")}
            {session.access.isProTrialActive && session.access.proTrialEndsAt
              ? ` · Pro access through ${new Date(session.access.proTrialEndsAt).toLocaleDateString()}`
              : ""}
          </Banner>
        ) : null}
        <Outlet />
      </main>

      {canOperate ? (
        <nav className="ry-mobile-bottom-nav" aria-label="Mobile primary">
          {mobileBottomNavigation.map((item) => (
            <BottomNavLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              currentPath={location.pathname}
              {...(item.exact ? { exact: true } : {})}
            />
          ))}
          <button
            type="button"
            className={mobileOpen ? "active" : ""}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen(true)}
            ref={moreButtonRef}
          >
            <ShellIcon name="menu" />
            <span>More</span>
          </button>
        </nav>
      ) : (
        <nav className="ry-mobile-bottom-nav ry-mobile-bottom-nav-restricted" aria-label="Mobile access">
          <BottomNavLink
            to={canAccessProgram ? appPath("/program") : appPath("/access")}
            label={canAccessProgram ? "Program" : "Access"}
            icon="access"
            currentPath={location.pathname}
          />
          <button
            type="button"
            className={mobileOpen ? "active" : ""}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen(true)}
            ref={moreButtonRef}
          >
            <ShellIcon name="menu" />
            <span>More</span>
          </button>
        </nav>
      )}

      <span className="sr-only" role="status" aria-live="polite">
        {mobileOpen ? "Navigation menu opened" : "Navigation menu closed"}
      </span>
      <div id="mobile-navigation">
        <MobileMoreMenu
          open={mobileOpen}
          groups={groups}
          currentPath={location.pathname}
          currentSearch={location.search}
          name={session.user.name}
          email={session.user.email}
          role={session.user.role}
          programStatus={session.access.programStatus}
          proAccessState={session.access.proAccessState}
          subscriptionStatus={session.access.subscriptionStatus}
          canAccessProgram={canAccessProgram}
          canProfile={canProfile}
          canSettings={canSettings}
          unreadCount={unreadCount}
          isAdmin={isAdmin}
          onClose={closeMobileMenu}
          onLogout={signOut}
        />
      </div>
    </div>
  );
}
