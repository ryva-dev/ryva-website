import React, { type ReactNode } from "react";
import { classes } from "./shared";
import { Button, ButtonGroup } from "./actions";
import { Input, Select } from "./forms";

export function PageHeader({
  eyebrow: _eyebrow,
  title,
  description: _description,
  action,
  relation,
  className
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  relation?: ReactNode;
  className?: string;
}) {
  void _eyebrow;
  void _description;
  return (
    <header className={classes("ry-page-header", "page-header", className)}>
      <div>
        {relation ? <div className="ry-page-relation">{relation}</div> : null}
        <h1>{title}</h1>
      </div>
      {action ? <div className="page-action">{action}</div> : null}
    </header>
  );
}

export function SectionHeader({
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
  const selectedLabel = views?.find((view) => view.id === selected)?.name;
  return (
    <details className={classes("ry-saved-view", "saved-view-inline", className)}>
      <summary className="ry-saved-view-summary">
        <svg className="ry-saved-view-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <span>{selectedLabel ?? "Views"}</span>
      </summary>
      <div className="ry-saved-view-panel">
        <div className="ry-saved-view-controls">
          {views && onSelect ? (
            <label className="ry-saved-view-select">
              <span className="sr-only">Saved view</span>
              <Select
                controlSize="compact"
                value={selected ?? ""}
                onChange={(event) => onSelect(event.target.value)}
                aria-label="Saved view"
              >
                <option value="">Select view</option>
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
              aria-label="Saved view name"
              onChange={(event) => onNameChange(event.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            size="compact"
            className="ry-saved-view-save"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save view"}
          </Button>
        </div>
        {status ? <small role="status">{status}</small> : null}
      </div>
    </details>
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
