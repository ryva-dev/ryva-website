type NavbarProps = {
  currentView: string;
  items: Array<{ label: string; href: string }>;
  onAuthClick: () => void;
  onLogout: () => Promise<void>;
  onSearchChange: (value: string) => void;
  searchQuery: string;
  userName: string | null;
};

export function Navbar({
  currentView,
  items,
  onAuthClick,
  onLogout,
  onSearchChange,
  searchQuery,
  userName
}: NavbarProps) {
  return (
    <header className="navbar">
      <a className="brand" href="#workers" aria-label="Ryva home">
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
      <div className="nav-actions">
        {userName ? (
          <>
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
        <a className="button button-primary" href="#hire">
          Hire a worker
        </a>
      </div>
    </header>
  );
}
