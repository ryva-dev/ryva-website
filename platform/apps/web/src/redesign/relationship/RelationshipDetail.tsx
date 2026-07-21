import {
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { Link } from "react-router-dom";
import { Button, Drawer } from "../../design-system";
import { classes } from "../../design-system/shared";

export type RelationshipTrailItem = {
  label: string;
  to?: string;
};

export function RelationshipTrail({ items }: { items: RelationshipTrailItem[] }) {
  return (
    <nav className="ry-relationship-trail" aria-label="Relationship trail">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export type RelationshipTab = {
  id: string;
  label: string;
  count?: number;
};

export function RelationshipTabs({
  tabs,
  active,
  onChange,
  label,
  baseId,
  className
}: {
  tabs: RelationshipTab[];
  active: string;
  onChange: (id: string) => void;
  label: string;
  baseId: string;
  className?: string;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    const nextTab = tabs[next];
    if (!nextTab) return;
    onChange(nextTab.id);
    buttons.current[next]?.focus();
  }

  return (
    <div className={classes("ry-relationship-tabs", className)} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => { buttons.current[index] = element; }}
          id={`${baseId}-tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`${baseId}-panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          <span>{tab.label}</span>
          {tab.count === undefined ? null : <span className="ry-tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function RelationshipTabPanel({
  id,
  tabId,
  active,
  children,
  className
}: {
  id: string;
  tabId: string;
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!active) return null;
  return (
    <section
      id={`${id}-panel-${tabId}`}
      className={classes("ry-relationship-tab-panel", className)}
      role="tabpanel"
      aria-labelledby={`${id}-tab-${tabId}`}
      tabIndex={0}
    >
      {children}
    </section>
  );
}

export function ContextRail({
  title,
  children,
  open,
  onOpen,
  onClose,
  className
}: {
  title: string;
  children: ReactNode;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  className?: string;
}) {
  const titleId = useId();
  return (
    <>
      <aside className={classes("ry-context-rail", className)} aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        <div className="ry-context-rail-content">{children}</div>
      </aside>
      <Button className="ry-context-trigger" variant="secondary" onClick={onOpen} aria-haspopup="dialog">
        Review context
      </Button>
      <Drawer
        open={open}
        title={title}
        description="Current relationship context, blockers, and next action."
        onClose={onClose}
        size="standard"
        className="ry-context-drawer"
      >
        <div className="ry-context-rail-content">{children}</div>
      </Drawer>
    </>
  );
}

export function RelationshipDetailLayout({
  children,
  context,
  className
}: {
  children: ReactNode;
  context: ReactNode;
  className?: string;
}) {
  return (
    <div className={classes("ry-relationship-layout", className)}>
      <div className="ry-relationship-main">{children}</div>
      {context}
    </div>
  );
}

export function RelationshipSection({
  title,
  description,
  action,
  children,
  className
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={classes("ry-relationship-section", className)}>
      <header>
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function StickyMobileAction({ children }: { children: ReactNode }) {
  return <div className="ry-relationship-mobile-action" aria-label="Current relationship action">{children}</div>;
}
