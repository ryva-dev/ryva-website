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
  children
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <Button variant="secondary" className="ry-register-filter-trigger" onClick={onOpen} aria-expanded={open}>
        Filters
      </Button>
      <div className="ry-register-filter-inline">{children}</div>
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
        className="ry-register-sort"
        onClick={() => onSort({ field, direction: active && sort.direction === "asc" ? "desc" : "asc" })}
      >
        {label}<span aria-hidden="true">{active ? (sort.direction === "asc" ? " ↑" : " ↓") : " ↕"}</span>
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
  columns: Array<{ id: string; label: string; required?: boolean }>;
  visible: Set<string>;
  onChange: (id: string, visible: boolean) => void;
  density: "comfortable" | "compact";
  onDensityChange: (density: "comfortable" | "compact") => void;
}) {
  return (
    <details className="ry-register-options">
      <summary>Columns and density</summary>
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
  onPage
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <nav className="ry-register-pagination" aria-label="Register pages">
      <p><span className="tabular-nums">{total}</span> {total === 1 ? "record" : "records"} · Page {page} of {pageCount}</p>
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
