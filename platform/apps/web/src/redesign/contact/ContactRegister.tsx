import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  DataRow,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Input,
  LoadingState,
  PageHeader,
  SearchInput,
  Select,
  StatusLabel,
  Table
} from "../../design-system";
import {
  ActiveFilters,
  RegisterFilterSheet,
  RegisterMobileList,
  RegisterMobileRow,
  SortableHeader,
  type RegisterFilterValue,
  type RegisterSort
} from "../register/Register";
import {
  canonicalContactPaths,
  contactName,
  contactParentLabel,
  contactPermission,
  contactVerification,
  date,
  dateTime,
  readable,
  shown,
  verificationStatuses,
  type ContactCompatibility,
  type ContactRow
} from "./utils";
import "./contact.css";

const initialFilters: RegisterFilterValue = {
  query: "",
  status: ""
};

export function ContactRegisterPage({
  compatibility = canonicalContactPaths
}: {
  compatibility?: ContactCompatibility;
}) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [businesses, setBusinesses] = useState<ContactRow[]>([]);
  const [brands, setBrands] = useState<ContactRow[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "updatedAt", direction: "desc" });
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [parentId, setParentId] = useState("");
  const [createError, setCreateError] = useState("");

  const businessMap = useMemo(
    () => new Map(businesses.map((item) => [item.id, item.name])),
    [businesses]
  );
  const brandMap = useMemo(
    () => new Map(brands.map((item) => [item.id, item.name])),
    [brands]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.status) params.set("status", filters.status);
    try {
      const [payload, businessPayload, brandPayload] = await Promise.all([
        api<{ records: ContactRow[] }>(`/api/records/contact?${params}`),
        api<{ records: ContactRow[] }>("/api/records/business"),
        api<{ records: ContactRow[] }>("/api/records/brand")
      ]);
      setRows(payload.records);
      setBusinesses(businessPayload.records);
      setBrands(brandPayload.records);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Contact records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  const sortedRows = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
      const read = (row: ContactRow, field: string) => {
        if (field === "role") return shown(row.role);
        if (field === "parent") return contactParentLabel(row, businessMap, brandMap);
        if (field === "verification") return contactVerification(row);
        if (field === "permission") return contactPermission(row);
        if (field === "nextAction") return shown(row.nextAction ?? row.next_action);
        if (field === "reviewed") return shown(row.lastVerifiedAt ?? row.last_verified_at ?? row.lastReviewedAt ?? row.last_reviewed_at);
        return shown(row[field]);
      };
      return read(left, sort.field).localeCompare(read(right, sort.field)) * direction;
    });
  }, [rows, sort, businessMap, brandMap]);

  const activeFilters = Object.entries(filters)
    .filter(([, value]) => value)
    .map(([id, value]) => ({
      id,
      label: `${id === "query" ? "Search" : readable(id)}: ${readable(String(value))}`
    }));

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setCreateError("");
    try {
      const result = await api<{ record: ContactRow }>("/api/records/contact", {
        method: "POST",
        body: {
          parentType: "business",
          parentId,
          name,
          role,
          ...(email.trim() ? { email: email.trim() } : {})
        }
      });
      setName("");
      setRole("");
      setEmail("");
      setParentId("");
      void navigate(compatibility.detailPath(result.record.id));
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Contact could not be created.");
    }
  }

  return (
    <div className="page ry-register-page ry-contact-page">
      <PageHeader
        eyebrow="Connected record kernel"
        title="Contact register"
        description="Professional Contacts linked to a Business or Brand. A Contact is an individual person; a Business is an organization; a Buyer is a role with purchasing authority recorded on the Business — not on the Contact."
        action={canWrite ? undefined : <Button disabled>Read-only access</Button>}
      />
      {compatibility.showCompatibilityNotice ? (
        <Alert className="ry-register-policy" title="Generic Contact register compatibility">
          This route reuses the canonical Contact relationship workspace. Links and APIs remain unchanged.
        </Alert>
      ) : null}
      <Alert className="ry-register-policy" title="Contact, Business, and Buyer are distinct">
        Contacts store professional routes and human verification only. They do not create Buyer authority, representation permission, or outreach approval.
      </Alert>
      {!canWrite ? (
        <Alert tone="warning" className="ry-register-policy" title="Read-only Contact register">
          You may inspect permitted Contact records, but cannot create Contacts or verify routes in this session.
        </Alert>
      ) : null}

      <section className="ry-register-surface" aria-label="Contact register results">
        <div className="ry-register-commandbar">
          <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
            <FilterBar>
              <Field label="Search Contacts">
                <SearchInput
                  label="Search Contacts"
                  controlSize="compact"
                  value={filters.query}
                  onChange={(event) => updateFilter("query", event.target.value)}
                  onClear={() => updateFilter("query", "")}
                />
              </Field>
              <Field label="Verification status">
                <Select controlSize="compact" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                  {verificationStatuses.map((item) => <option key={item || "all"} value={item}>{item ? readable(item) : "All"}</option>)}
                </Select>
              </Field>
            </FilterBar>
          </RegisterFilterSheet>
        </div>
        <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => setFilters(initialFilters)} />
        <div className="ry-register-resultbar">
          <span>{sortedRows.length} Contact{sortedRows.length === 1 ? "" : "s"} in this view</span>
        </div>
        {loading ? <LoadingState label="Loading Contact register" /> : error ? (
          <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
        ) : sortedRows.length === 0 ? (
          <EmptyState
            title={activeFilters.length ? "No Contacts match these filters" : "No Contacts in this view"}
            description={activeFilters.length ? "Clear one or more filters to return to the working Contact register." : "Create an unverified Contact linked to a Business to begin professional route verification."}
            action={activeFilters.length ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button> : undefined}
          />
        ) : (
          <>
            <Table caption="Contact register">
              <thead>
                <tr>
                  <SortableHeader field="name" label="Name" sort={sort} onSort={setSort} />
                  <SortableHeader field="role" label="Role" sort={sort} onSort={setSort} />
                  <SortableHeader field="parent" label="Parent" sort={sort} onSort={setSort} />
                  <SortableHeader field="verification" label="Verification" sort={sort} onSort={setSort} />
                  <SortableHeader field="permission" label="Permission" sort={sort} onSort={setSort} />
                  <SortableHeader field="nextAction" label="Next action" sort={sort} onSort={setSort} />
                  <SortableHeader field="reviewed" label="Reviewed" sort={sort} onSort={setSort} />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <DataRow key={row.id}>
                    <td><Link to={compatibility.detailPath(row.id)}><strong>{contactName(row)}</strong></Link></td>
                    <td>{shown(row.role, "Not recorded")}</td>
                    <td>{contactParentLabel(row, businessMap, brandMap)}</td>
                    <td><StatusLabel value={contactVerification(row)} /></td>
                    <td><StatusLabel value={contactPermission(row)} /></td>
                    <td>{shown(row.nextAction ?? row.next_action, "Not assigned")}</td>
                    <td>{row.lastVerifiedAt || row.last_verified_at ? dateTime(row.lastVerifiedAt ?? row.last_verified_at) : date(row.lastReviewedAt ?? row.last_reviewed_at)}</td>
                  </DataRow>
                ))}
              </tbody>
            </Table>
            <RegisterMobileList label="Contact register results">
              {sortedRows.map((row) => (
                <RegisterMobileRow
                  key={row.id}
                  title={contactName(row)}
                  meta={`${shown(row.role, "Role not recorded")} · ${contactParentLabel(row, businessMap, brandMap)} · ${readable(contactVerification(row))} · ${readable(contactPermission(row))}`}
                  status={<StatusLabel value={contactVerification(row)} />}
                  onOpen={() => void navigate(compatibility.detailPath(row.id))}
                  openLabel={`Open Contact ${contactName(row)}`}
                />
              ))}
            </RegisterMobileList>
          </>
        )}
      </section>

      <section className="ry-contact-create panel" aria-label="Create unverified Contact">
        <h2>Create Contact</h2>
        <p>New Contacts begin unverified. Link to a Business parent; the stored role does not create Buyer purchasing authority.</p>
        {createError ? <ErrorState message={createError} /> : null}
        <form className="ry-contact-create-form" onSubmit={(event) => void create(event)}>
          <Field label="Business parent" required>
            <Select required value={parentId} onChange={(event) => setParentId(event.target.value)} disabled={!canWrite}>
              <option value="">Select…</option>
              {businesses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Name" required><Input required value={name} onChange={(event) => setName(event.target.value)} disabled={!canWrite} /></Field>
          <Field label="Role" required><Input required value={role} onChange={(event) => setRole(event.target.value)} disabled={!canWrite} /></Field>
          <Field label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!canWrite} /></Field>
          <Button type="submit" disabled={!canWrite}>Create unverified Contact</Button>
        </form>
      </section>
    </div>
  );
}
