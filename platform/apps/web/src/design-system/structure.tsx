import type { ReactNode } from "react";
import { classes } from "./shared";
import { ButtonGroup } from "./actions";
import { Input, Select } from "./forms";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  relation,
  className
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  relation?: ReactNode;
  className?: string;
}) {
  return (
    <header className={classes("ry-page-header", "page-header", className)}>
      <div>
        {relation ? <div className="ry-page-relation">{relation}</div> : null}
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="page-action">{action}</div> : null}
    </header>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={classes("ry-section-header", "section-heading", className)}>
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Toolbar({
  label,
  children,
  actions,
  className
}: {
  label: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={classes("ry-toolbar", className)} aria-label={label}>
      <div className="ry-toolbar-controls">{children}</div>
      {actions ? <ButtonGroup>{actions}</ButtonGroup> : null}
    </section>
  );
}

export function FilterBar({
  children,
  actions,
  label = "Filters",
  className
}: {
  children: ReactNode;
  actions?: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <section className={classes("ry-filter-bar", "filter-panel", className)} aria-label={label}>
      {children}
      {actions ? <ButtonGroup>{actions}</ButtonGroup> : null}
    </section>
  );
}

export function SavedViewSelector({
  views,
  selected,
  onSelect,
  newName,
  onNameChange,
  onSave,
  saving = false,
  status,
  className
}: {
  views?: Array<{ id: string; name: string }>;
  selected?: string;
  onSelect?: (id: string) => void;
  newName: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  saving?: boolean;
  status?: string;
  className?: string;
}) {
  return (
    <div className={classes("ry-saved-view", "saved-view-inline", className)}>
      {views && onSelect ? (
        <label className="ry-saved-view-select">
          <span className="sr-only">Saved view</span>
          <Select controlSize="compact" value={selected ?? ""} onChange={(event) => onSelect(event.target.value)}>
            <option value="">Select saved view</option>
            {views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
          </Select>
        </label>
      ) : null}
      <label className="ry-saved-view-name">
        <span className="sr-only">Saved view name</span>
        <Input
          controlSize="compact"
          value={newName}
          placeholder="View name"
          onChange={(event) => onNameChange(event.target.value)}
        />
      </label>
      <button className="secondary-button ry-saved-view-save" type="button" disabled={saving} onClick={onSave}>
        {saving ? "Saving…" : "Save view"}
      </button>
      {status ? <small role="status">{status}</small> : null}
    </div>
  );
}

export function Tabs({
  label,
  children,
  className
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return <nav className={classes("ry-tabs", "subnav", className)} aria-label={label}>{children}</nav>;
}
