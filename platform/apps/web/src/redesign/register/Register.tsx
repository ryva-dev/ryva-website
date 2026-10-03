import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "../../api";
import {
  Button,
  ButtonGroup,
  Checkbox,
  Drawer,
  SavedViewSelector,
  Select
} from "../../design-system";
import { classes } from "../../design-system/shared";

export type RegisterSort = { field: string; direction: "asc" | "desc" };
export type RegisterFilterValue = Record<string, string>;

type SavedView = {
  id: string;
  name: string;
  recordType: string;
  definition: {
    filters: Array<{ field: string; operator: string; value: unknown }>;
    sort: RegisterSort[];
    layout: string;
  };
};

export function RegisterSavedViews({
  recordType,
  filters,
  sort,
  canWrite,
  onApply
}: {
  recordType: string;
  filters: RegisterFilterValue;
  sort: RegisterSort;
  canWrite: boolean;
  onApply: (filters: RegisterFilterValue, sort: RegisterSort) => void;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await api<{ views: SavedView[] }>("/api/saved-views");
      setViews(result.views.filter((view) => view.recordType === recordType));
    } catch {
      setStatus("Saved views are unavailable.");
    }
  }, [recordType]);

  useEffect(() => { void load(); }, [load]);

  function apply(id: string) {
    setSelected(id);
    const view = views.find((candidate) => candidate.id === id);
    if (!view) return;
    const nextFilters = Object.fromEntries(view.definition.filters.map((filter) => [
      filter.field,
      typeof filter.value === "string" || typeof filter.value === "number" || typeof filter.value === "boolean"
        ? String(filter.value)
        : ""
    ]));
    onApply(nextFilters, view.definition.sort[0] ?? sort);
    setStatus(`Applied ${view.name}.`);
  }

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setStatus("Enter a view name before saving.");
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      await api("/api/saved-views", {
        method: "POST",
        body: {
          recordType,
          name: trimmedName,
          definition: {
            filters: Object.entries(filters)
              .filter(([, value]) => value !== "")
              .map(([field, value]) => ({ field, operator: field === "query" ? "contains" : "equals", value })),
            sort: [sort],
            layout: "table"
          },
          scope: "private"
        }
      });
      setName("");
      setStatus(`Saved ${trimmedName}.`);
      await load();
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "The view could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const viewStatus = status || (!canWrite ? "Read-only access cannot save views." : "");
  return (
    <SavedViewSelector
      views={views}
      selected={selected}
      onSelect={apply}
      newName={name}
      onNameChange={setName}
      onSave={() => void save()}
      saving={saving}
      {...(viewStatus ? { status: viewStatus } : {})}
      {...(!canWrite ? { className: "ry-register-view-read-only" } : {})}
    />
  );
}

export function RegisterFilterSheet({
  open,
  onOpen,
  onClose,
  children,
  showInline = true,
  triggerLabel = "Filters"
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
  showInline?: boolean;
  triggerLabel?: string;
}) {
  return (
    <>
      <Button variant="secondary" className="ry-register-filter-trigger" onClick={onOpen} aria-expanded={open}>
        {triggerLabel}
      </Button>
      {showInline ? <div className="ry-register-filter-inline">{children}</div> : null}
      <Drawer open={open} title="Filter results" description="Narrow this register without losing the current saved view or result context." onClose={onClose} className="ry-register-filter-drawer">
        {children}
      </Drawer>
    </>
  );
}

export function ActiveFilters({
  filters,
  onClear,
  onClearAll
}: {
  filters: Array<{ id: string; label: string }>;
  onClear: (id: string) => void;
  onClearAll: () => void;
}) {
  if (!filters.length) return null;
  return (
    <div className="ry-register-active-filters" aria-label="Active filters">
      {filters.map((filter) => (
        <button type="button" key={filter.id} onClick={() => onClear(filter.id)}>
          {filter.label}<span aria-hidden="true"> ×</span><span className="sr-only">, remove filter</span>
        </button>
      ))}
      <Button variant="tertiary" size="compact" onClick={onClearAll}>Clear all</Button>
    </div>
  );
}

export function SortableHeader({
  field,
  label,
  sort,
  onSort,
  className
}: {
  field: string;
  label: string;
  sort: RegisterSort;
  onSort: (sort: RegisterSort) => void;
  className?: string;
}) {
  const active = sort.field === field;
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
      <button
        type="button"
        className={classes("ry-register-sort", active && "ry-register-sort-active")}
        onClick={() => onSort({ field, direction: active && sort.direction === "asc" ? "desc" : "asc" })}
      >
        {label}
        {active ? <span className="ry-register-sort-indicator" aria-hidden="true">{sort.direction === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}

export function RegisterColumnSelector({
  columns,
  visible,
  onChange,
  density,
  onDensityChange
}: {
  columns: ReadonlyArray<{ id: string; label: string; required?: boolean }>;
  visible: Set<string>;
  onChange: (id: string, visible: boolean) => void;
  density: "comfortable" | "compact";
  onDensityChange: (density: "comfortable" | "compact") => void;
}) {
  return (
    <details className="ry-register-options">
      <summary>
        <svg className="ry-register-options-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
        <span>Columns and density</span>
      </summary>
      <div>
        <label className="ry-register-density">
          <span>Row density</span>
          <Select controlSize="compact" value={density} onChange={(event) => onDensityChange(event.target.value as "comfortable" | "compact")}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </Select>
        </label>
        {columns.map((column) => (
          <Checkbox
            key={column.id}
            label={column.label}
            checked={visible.has(column.id)}
            disabled={column.required}
            onChange={(event) => onChange(column.id, event.target.checked)}
          />
        ))}
      </div>
    </details>
  );
}

export function RegisterPagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const rangeLabel = total === 0
    ? "0 shown"
    : start === end
      ? `${start} shown`
      : `${start}–${end} shown`;

  return (
    <nav className="ry-register-pagination" aria-label="Register pages">
      <p><span className="tabular-nums">{rangeLabel}</span> · Page {page} of {pageCount}</p>
      <ButtonGroup>
        <Button variant="secondary" size="compact" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button variant="secondary" size="compact" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>Next</Button>
      </ButtonGroup>
    </nav>
  );
}

export function RegisterMobileList({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return <div className="ry-register-mobile-list" role="list" aria-label={label}>{children}</div>;
}

export function RegisterMobileRow({
  title,
  meta,
  status,
  onOpen,
  openLabel,
  actions
}: {
  title: string;
  meta: ReactNode;
  status?: ReactNode;
  onOpen: () => void;
  openLabel: string;
  actions?: ReactNode;
}) {
  return (
    <article className="ry-register-mobile-row" role="listitem">
      <button type="button" className="ry-register-mobile-identity" onClick={onOpen} aria-label={openLabel}>
        <strong>{title}</strong>
        <span>{meta}</span>
      </button>
      <div className="ry-register-mobile-actions">{status}{actions}</div>
    </article>
  );
}

export function RegisterCreateBlockHeader({
  title,
  description,
  id
}: {
  title: string;
  description?: string;
  id?: string;
}) {
  return (
    <header className="ry-register-create-block-header">
      <h3 {...(id ? { id } : {})}>{title}</h3>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

export function RegisterCreateFooter({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={classes("ry-register-create-footer", className)}>{children}</div>;
}
