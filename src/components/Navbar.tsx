type NavbarProps = {
  currentView: string;
  items: Array<{ label: string; href: string }>;
  onAuthClick: () => void;
  officeHref: string | null;
  onLogout: () => Promise<void>;
  onSearchChange: (value: string) => void;
  searchQuery: string;
  showSearch: boolean;
  userName: string | null;
};

export function Navbar({
  currentView,
  items,
  onAuthClick,
  officeHref,
  onLogout,
  onSearchChange,
  searchQuery,
  showSearch,
  userName
}: NavbarProps) {
  return (
    <header className="navbar">
      <a className="brand" href="#home" aria-label="Ryva home">
        <span>Ryva</span>
      </a>
      <nav className="nav-links" aria-label="Primary">
        {items.map((item) => (
          <a
            className={currentView === item.href.replace("#", "") ? "nav-link-active" : ""}
            key={item.href}
            href={item.href}
          >
            {item.label}
          </a>
        ))}
      </nav>
      {showSearch ? (
        <label className="navbar-search" htmlFor="worker-search">
          <span className="navbar-search-icon" aria-hidden="true">
            ○
          </span>
          <input
            id="worker-search"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search workers by role, skill, department..."
            type="search"
            value={searchQuery}
          />
        </label>
      ) : (
        <div className="navbar-search-spacer" aria-hidden="true" />
      )}
      <div className="nav-actions">
        {userName ? (
          <>
            {officeHref ? (
              <a className="button button-secondary" href={officeHref}>
                Office
              </a>
            ) : null}
            <span className="nav-user">Hi, {userName}</span>
            <button className="nav-signin nav-button" onClick={() => void onLogout()} type="button">
              Sign out
            </button>
          </>
        ) : (
          <button className="nav-signin nav-button" onClick={onAuthClick} type="button">
            Sign in
          </button>
        )}
        <a className="button button-primary" href="#workers">
          Hire a worker
        </a>
      </div>
    </header>
  );
}
