import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Banner, LoadingState, StatusLabel } from "../../design-system";
import { designTokens } from "../../design/tokens";
import { buildShellNavigation, shellRouteLabel, type ShellNavGroup, type ShellNavItem } from "./navigation";
import { ShellIcon, type ShellIconName } from "./ShellIcon";

type ViewportMode = "mobile" | "tablet" | "desktop";
type NotificationSummary = { status: string };

function currentViewport(): ViewportMode {
  if (typeof window === "undefined") return "desktop";
  if (window.innerWidth <= designTokens.breakpoint.mobile) return "mobile";
  if (window.innerWidth <= designTokens.breakpoint.desktop) return "tablet";
  return "desktop";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "R";
}

function itemIsActive(item: ShellNavItem, pathname: string, search: string): boolean {
  const [itemPath, itemSearch = ""] = item.to.split("?");
  if (itemSearch) return pathname === itemPath && new URLSearchParams(search).get("view") === new URLSearchParams(itemSearch).get("view");
  if (item.to === "/analytics") return pathname === "/analytics" && new URLSearchParams(search).get("view") !== "reports";
  return item.exact ? pathname === itemPath : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
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
  const active = itemIsActive(item, pathname, search);
  return (
    <NavLink
      to={item.to}
      className={active ? "ry-shell-link active" : "ry-shell-link"}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      data-tooltip={collapsed ? item.label : undefined}
      onClick={onNavigate}
    >
      <ShellIcon name={item.icon} />
      <span className="ry-shell-link-label">{item.label}</span>
    </NavLink>
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

function UtilityLink({
  to,
  label,
  icon,
  collapsed,
  count,
  onNavigate
}: {
  to: string;
  label: string;
  icon: "search" | "notifications";
  collapsed: boolean;
  count?: number;
  onNavigate: () => void;
}) {
  const countLabel = count ? `${count > 99 ? "99+" : count} unread` : "";
  return (
    <Link
      className="ry-shell-utility-link"
      to={to}
      aria-label={`${label}${countLabel ? `, ${countLabel}` : ""}`}
      data-tooltip={collapsed ? label : undefined}
      onClick={onNavigate}
    >
      <ShellIcon name={icon} />
      <span className="ry-shell-link-label">{label}</span>
      {count ? <span className="ry-notification-count" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}
    </Link>
  );
}

function ProfileMenu({
  name,
  role,
  credentialStatus,
  subscriptionStatus,
  collapsed,
  canProfile,
  canSettings,
  onLogout
}: {
  name: string;
  role: string;
  credentialStatus: string | null;
  subscriptionStatus: string | null;
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
        <span className="ry-profile-initials" aria-hidden="true">{initials(name)}</span>
        <span className="ry-profile-summary">
          <strong>{name}</strong>
          <small>{credentialStatus === "active" && subscriptionStatus === "active" ? role : "Review access status"}</small>
        </span>
        <ShellIcon name="chevron" />
      </summary>
      <div className="ry-profile-popover">
        <header>
          <strong>{name}</strong>
          <small>Ryva workspace · {role}</small>
        </header>
        <div className="ry-profile-statuses">
          <span>Certification <StatusLabel value={credentialStatus ?? "not_linked"} /></span>
          <span>Subscription <StatusLabel value={subscriptionStatus ?? "not_active"} /></span>
        </div>
        <nav aria-label="Profile and access">
          {canProfile ? <Link to="/profile" onClick={closeAndFocus}>Profile</Link> : null}
          <Link to="/certification" onClick={closeAndFocus}>Certification</Link>
          <Link to="/subscription" onClick={closeAndFocus}>Subscription</Link>
          {canSettings ? <Link to="/settings" onClick={closeAndFocus}>Settings</Link> : null}
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
  role,
  credentialStatus,
  subscriptionStatus,
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
  role: string;
  credentialStatus: string | null;
  subscriptionStatus: string | null;
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
            <Link to="/notifications" onClick={onClose}>
              <ShellIcon name="notifications" />
              <span>Notifications</span>
              {unreadCount ? <span className="ry-notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
            </Link>
            {canProfile ? <Link to="/profile" onClick={onClose}><ShellIcon name="profile" /><span>Profile</span></Link> : null}
            <Link to="/certification" onClick={onClose}><ShellIcon name="access" /><span>Certification</span><StatusLabel value={credentialStatus ?? "not_linked"} /></Link>
            <Link to="/subscription" onClick={onClose}><ShellIcon name="accounts" /><span>Subscription</span><StatusLabel value={subscriptionStatus ?? "not_active"} /></Link>
            {canSettings ? <Link to="/settings" onClick={onClose}><ShellIcon name="settings" /><span>Settings</span></Link> : null}
          </section>
          <footer>
            <span className="ry-profile-initials" aria-hidden="true">{initials(name)}</span>
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
      <span className="ry-shell-monogram" aria-hidden="true">R</span>
      <span className="ry-shell-wordmark">
        <strong>Ryva</strong>
        <small>PRO</small>
      </span>
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
  isAdmin,
  userName,
  userRole,
  credentialStatus,
  subscriptionStatus,
  canProfile,
  canSettings,
  onToggle,
  onNavigate,
  onLogout
}: {
  groups: ShellNavGroup[];
  collapsed: boolean;
  tabletOpen: boolean;
  viewport: ViewportMode;
  pathname: string;
  search: string;
  canOperate: boolean;
  unreadCount: number;
  isAdmin: boolean;
  userName: string;
  userRole: string;
  credentialStatus: string | null;
  subscriptionStatus: string | null;
  canProfile: boolean;
  canSettings: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  const visuallyCollapsed = viewport === "tablet" ? !tabletOpen : collapsed;
  return (
    <>
      {tabletOpen ? <button className="ry-tablet-scrim" type="button" onClick={onToggle} aria-label="Close navigation" /> : null}
      <aside className="ry-sidebar" aria-label="Ryva application">
        <header>
          <ShellBrand destination={canOperate ? "/" : "/access"} />
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
        {canOperate ? (
          <UtilityLink to="/search" label="Search" icon="search" collapsed={visuallyCollapsed} onNavigate={onNavigate} />
        ) : null}
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
            <UtilityLink
              to="/notifications"
              label="Notifications"
              icon="notifications"
              collapsed={visuallyCollapsed}
              count={unreadCount}
              onNavigate={onNavigate}
            />
          ) : null}
          <ProfileMenu
            name={userName}
            role={userRole}
            credentialStatus={credentialStatus}
            subscriptionStatus={subscriptionStatus}
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
    if (viewport !== "tablet") setTabletOpen(false);
    if (viewport !== "mobile") setMobileOpen(false);
  }, [viewport]);

  useEffect(() => {
    if (!session?.access.capabilities.includes("operational:read")) {
      setUnreadCount(0);
      return;
    }
    let active = true;
    void api<{ notifications: NotificationSummary[] }>("/api/notifications")
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

  useEffect(() => {
    const onShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMobileOpen(false);
        setTabletOpen(false);
        void navigate("/search");
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [navigate]);

  if (loading) return <LoadingState label="Checking secure access" />;
  if (!session) return <Navigate to="/login" replace />;

  const canOperate = session.access.capabilities.includes("operational:read");
  const canProfile = session.access.capabilities.includes("profile:read");
  const canSettings = session.access.capabilities.includes("settings:read");
  const isAdmin = session.user.role === "admin" || session.user.role === "support";
  const groups = buildShellNavigation(session);
  const shellCollapsed = viewport === "tablet"
    ? !tabletOpen
    : viewport === "desktop"
      ? collapsed
      : false;
  const userId = session.user.id;

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
        isAdmin={isAdmin}
        userName={session.user.name}
        userRole={session.user.role}
        credentialStatus={session.access.credentialStatus}
        subscriptionStatus={session.access.subscriptionStatus}
        canProfile={canProfile}
        canSettings={canSettings}
        onToggle={toggleSidebar}
        onNavigate={closeNavigation}
        onLogout={signOut}
      />

      <header className="ry-mobile-topbar">
        <ShellBrand destination={canOperate ? "/" : "/access"} />
        <strong>{shellRouteLabel(location.pathname)}</strong>
        {canOperate ? (
          <Link to="/notifications" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}>
            <ShellIcon name="notifications" />
            {unreadCount ? <span className="ry-notification-count" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
          </Link>
        ) : <span />}
      </header>

      <main id="main-content" className="ry-shell-canvas">
        {session.access.mode !== "full" ? (
          <Banner tone={accessTone} title={session.access.mode.replaceAll("_", " ")}>
            {session.access.reason.replaceAll("_", " ")}
            {session.access.graceEndsAt
              ? ` · review by ${new Date(session.access.graceEndsAt).toLocaleDateString()}`
              : ""}
          </Banner>
        ) : null}
        <Outlet />
      </main>

      {canOperate ? (
        <nav className="ry-mobile-bottom-nav" aria-label="Mobile primary">
          <BottomNavLink to="/" label="Home" icon="home" currentPath={location.pathname} exact />
          <BottomNavLink to="/tasks" label="Tasks" icon="tasks" currentPath={location.pathname} />
          <BottomNavLink to="/placements" label="Placements" icon="placement" currentPath={location.pathname} />
          <BottomNavLink to="/search" label="Search" icon="search" currentPath={location.pathname} />
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
          <BottomNavLink to="/access" label="Access" icon="access" currentPath={location.pathname} />
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
          role={session.user.role}
          credentialStatus={session.access.credentialStatus}
          subscriptionStatus={session.access.subscriptionStatus}
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
