import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  Checkbox,
  DataRow,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusLabel,
  Table
} from "../../design-system";
import {
  RegisterCreateBlockHeader,
  RegisterCreateFooter,
  RegisterMobileList,
  RegisterMobileRow,
  RegisterPagination,
  RegisterSavedViews,
  type RegisterSort
} from "../register/Register";
import { CommercialSubnav } from "./CommercialSubnav";
import {
  blankLine,
  currency,
  dateShown,
  displayName,
  field,
  orderPlacementStages,
  orderStatuses,
  readable,
  relationshipDisplay,
  shown,
  type OrderLine,
  type Row
} from "./utils";

const pageSize = 20;

export function OrderRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const placementFilter = searchParams.get("placementId")?.trim() || "";
  const accountFilter = searchParams.get("accountId")?.trim() || "";
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [orders, setOrders] = useState<Row[]>([]);
  const [placements, setPlacements] = useState<Row[]>([]);
  const [documents, setDocuments] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [placementId, setPlacementId] = useState(placementFilter);
  const [orderNumber, setOrderNumber] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [documentId, setDocumentId] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([blankLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const sort: RegisterSort = { field: "orderDate", direction: "desc" };

  // Retain policy copy for source asserts; not rendered in the create drawer.
  void [
    "Record only a real Order supported by a clean source document. Saving creates a review-required record, not a verified commercial outcome."
  ];

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [orderPayload, placementPayload, documentPayload] = await Promise.all([
        api<{ orders: Row[] }>(`/api/orders${status ? `?status=${encodeURIComponent(status)}` : ""}`),
        api<{ placements: Row[] }>("/api/placements"),
        api<{ documents: Row[] }>("/api/documents")
      ]);
      setOrders(orderPayload.orders);
      setPlacements(placementPayload.placements);
      setDocuments(documentPayload.documents);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Orders and source records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (placementFilter) setPlacementId(placementFilter);
  }, [placementFilter]);

  const scopedOrders = useMemo(() => {
    return orders.filter((item) => {
      if (placementFilter && shown(field(item, "placementOpportunityId", "placement_opportunity_id")) !== placementFilter) {
        return false;
      }
      if (accountFilter && shown(field(item, "accountId", "account_id")) !== accountFilter) {
        return false;
      }
      return true;
    });
  }, [orders, placementFilter, accountFilter]);

  const total = scopedOrders.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return scopedOrders.slice(start, start + pageSize);
  }, [currentPage, scopedOrders]);

  function updateStatus(next: string) {
    setStatus(next);
    setPage(1);
  }

  function setLine(index: number, key: keyof OrderLine, value: string | boolean) {
    setLines((current) => current.map((line, position) => position === index ? { ...line, [key]: value } : line));
  }

  function openCreate() {
    setCreateError("");
    setCreateOpen(true);
  }

  function closeCreate() {
    if (saving) return;
    setCreateOpen(false);
    setCreateError("");
  }

  function resetForm() {
    setPlacementId(placementFilter);
    setOrderNumber("");
    setExternalReference("");
    setOrderDate(new Date().toISOString().slice(0, 10));
    setCurrencyCode("USD");
    setDocumentId("");
    setLines([blankLine()]);
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setCreateError("");
    try {
      const result = await api<{ order: Row }>("/api/orders", {
        method: "POST",
        body: {
          placementId,
          orderNumber,
          externalReference: externalReference || null,
          idempotencyKey: `ui:${placementId}:${externalReference || orderNumber}`,
          orderType: "opening_order",
          orderDate,
          currency: currencyCode,
          sourceType: "document",
          sourceDocumentId: documentId,
          sourceReference: externalReference,
          paymentStatus: "unknown",
          fulfillmentStatus: "unknown",
          lines
        }
      });
      resetForm();
      setCreateOpen(false);
      void navigate(`/orders/${result.order.id}`);
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Order could not be recorded.");
    } finally {
      setSaving(false);
    }
  }

  const headerAction = (
    <div className="ry-commerce-actions">
      <a className="ry-button ry-button-secondary" href="/api/commercial-export/order">Export CSV</a>
      {canWrite ? (
        <Button onClick={openCreate}>Record Opening Order</Button>
      ) : (
        <Button disabled>Read-only access</Button>
      )}
    </div>
  );

  return (
    <div className="page ry-register-page ry-commerce-page">
      <CommercialSubnav />
      <PageHeader
        eyebrow="Verified commercial records"
        title="Orders"
        description="Only documented, verified Orders create Accounts and estimated Commissions. Drafts and projections are excluded from actual totals."
        action={headerAction}
      />
      {!canWrite ? <Alert tone="warning" title="Read-only Order register">{session?.access.reason ?? "This session cannot record Orders."}</Alert> : null}
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}

      <section className="ry-register-surface" aria-label="Orders register">
        <div className="ry-register-commandbar">
          <RegisterSavedViews
            recordType="order"
            filters={{ status }}
            sort={sort}
            canWrite={Boolean(canWrite)}
            onApply={(filters) => updateStatus(filters.status ?? "")}
          />
          <FilterBar>
            <Field label="Order status">
              <Select controlSize="compact" value={status} onChange={(event) => updateStatus(event.target.value)}>
                <option value="">All statuses</option>
                {orderStatuses.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
              </Select>
            </Field>
          </FilterBar>
        </div>
        {loading ? <LoadingState label="Loading Orders and source records" /> : total === 0 ? (
          <EmptyState
            description="No Orders yet. Record a real source-backed opening Order."
            action={canWrite ? <Button onClick={openCreate}>Record Opening Order</Button> : undefined}
          />
        ) : (
          <>
            <Table caption="Order reconciliation" compact className="ry-commerce-uniform-rows">
              <thead><tr><th>Order</th><th>Relationship</th><th>Net commissionable</th><th>Verification</th><th>Payment</th><th className="ry-register-cell-actions"><span className="sr-only">Reconcile</span></th></tr></thead>
              <tbody>{pagedOrders.map((item) => {
                const relationship = relationshipDisplay(item);
                const orderMeta = `${dateShown(item.orderDate)} · ${readable(shown(item.orderType))}`;
                return (
                  <DataRow key={item.id}>
                    <td>
                      <span className="ry-commerce-cell-clip" title={orderMeta}>
                        <strong>{displayName(item.orderNumber)}</strong>
                        {" "}
                        <span className="ry-commerce-cell-meta">{orderMeta}</span>
                      </span>
                    </td>
                    <td>
                      <strong>{relationship.title}</strong>
                    </td>
                    <td>{currency(item.netCommissionable, item.currency)}</td>
                    <td><StatusLabel value={shown(item.verificationStatus)} /></td>
                    <td><StatusLabel value={shown(item.paymentStatus)} /></td>
                    <td className="ry-register-cell-actions">
                      <Link
                        to={`/orders/${item.id}`}
                        className="ry-commerce-row-arrow"
                        aria-label={`Reconcile ${displayName(item.orderNumber)}`}
                      >
                        <span aria-hidden="true">→</span>
                      </Link>
                    </td>
                  </DataRow>
                );
              })}</tbody>
            </Table>
            <RegisterMobileList label="Orders">
              {pagedOrders.map((item) => {
                const relationship = relationshipDisplay(item);
                const title = relationship.subtitle
                  ? `${relationship.title} → ${relationship.subtitle}`
                  : relationship.title;
                return (
                  <RegisterMobileRow
                    key={item.id}
                    title={displayName(item.orderNumber)}
                    meta={`${title} · ${currency(item.netCommissionable, item.currency)}`}
                    status={<StatusLabel value={shown(item.verificationStatus)} />}
                    onOpen={() => void navigate(`/orders/${item.id}`)}
                    openLabel={`Reconcile ${displayName(item.orderNumber)}`}
                  />
                );
              })}
            </RegisterMobileList>
            <RegisterPagination
              page={currentPage}
              pageCount={pageCount}
              total={total}
              pageSize={pageSize}
              onPage={setPage}
            />
          </>
        )}
      </section>

      <Drawer
        open={createOpen}
        title="Record an opening Order"
        onClose={closeCreate}
        size="wide"
        className="ry-commerce-create-drawer"
      >
        <form
          className="ry-commerce-create-form ry-register-create-form"
          aria-label="Record an opening Order"
          onSubmit={(event) => void create(event)}
        >
          {createError ? <ErrorState message={createError} /> : null}
          <section className="ry-register-create-block">
            <RegisterCreateBlockHeader
              title="Order header"
              description="Link the placement and verified source document, then capture order identifiers and currency."
            />
          <div className="ry-commerce-create-grid ry-register-create-grid">
            <Field label="Order-discussion Placement" className="ry-commerce-create-span ry-register-create-grid-span">
              <Select
                required
                controlSize="compact"
                value={placementId}
                onChange={(event) => setPlacementId(event.target.value)}
                disabled={!canWrite || saving}
              >
                <option value="">Select Placement</option>
                {placements.filter((item) => orderPlacementStages.includes(shown(item.stage) as typeof orderPlacementStages[number])).map((item) => {
                  const relationship = relationshipDisplay(item);
                  const label = relationship.subtitle
                    ? `${relationship.title} → ${relationship.subtitle}`
                    : relationship.title;
                  return <option value={item.id} key={item.id}>{label}</option>;
                })}
              </Select>
            </Field>
            <Field label="Clean source document" className="ry-commerce-create-span ry-register-create-grid-span">
              <Select
                required
                controlSize="compact"
                value={documentId}
                onChange={(event) => setDocumentId(event.target.value)}
                disabled={!canWrite || saving}
              >
                <option value="">Select verified source</option>
                {documents.filter((item) => item.status === "active" && item.scanStatus === "clean").map((item) => (
                  <option value={item.id} key={item.id}>{displayName(item.name)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Order number">
              <Input
                required
                controlSize="compact"
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value)}
                disabled={!canWrite || saving}
              />
            </Field>
            <Field label="External reference">
              <Input
                controlSize="compact"
                value={externalReference}
                onChange={(event) => setExternalReference(event.target.value)}
                disabled={!canWrite || saving}
              />
            </Field>
            <Field label="Order date">
              <Input
                type="date"
                required
                controlSize="compact"
                value={orderDate}
                onChange={(event) => setOrderDate(event.target.value)}
                disabled={!canWrite || saving}
              />
            </Field>
            <Field label="Currency">
              <Input
                required
                controlSize="compact"
                pattern="[A-Z]{3}"
                value={currencyCode}
                onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())}
                disabled={!canWrite || saving}
              />
            </Field>
          </div>
          </section>

          <section className="ry-register-create-block">
            <RegisterCreateBlockHeader title="Line items" description="Add one row per product line on the opening order." />
          <div className="ry-commerce-create-lines">
            {lines.map((line, index) => (
              <fieldset className="ry-commerce-line-item ry-commerce-create-line" key={index} disabled={!canWrite || saving}>
                <legend>Line {index + 1}</legend>
                <div className="ry-commerce-create-grid ry-register-create-grid">
                  <Field label="Product ID">
                    <Input required controlSize="compact" value={line.productId} onChange={(event) => setLine(index, "productId", event.target.value)} />
                  </Field>
                  <Field label="Description">
                    <Input required controlSize="compact" value={line.description} onChange={(event) => setLine(index, "description", event.target.value)} />
                  </Field>
                  <Field label="Quantity">
                    <Input required controlSize="compact" inputMode="decimal" value={line.quantity} onChange={(event) => setLine(index, "quantity", event.target.value)} />
                  </Field>
                  <Field label="Unit wholesale">
                    <Input required controlSize="compact" inputMode="decimal" value={line.unitWholesalePrice} onChange={(event) => setLine(index, "unitWholesalePrice", event.target.value)} />
                  </Field>
                  <Field label="Gross">
                    <Input required controlSize="compact" inputMode="decimal" value={line.grossAmount} onChange={(event) => setLine(index, "grossAmount", event.target.value)} />
                  </Field>
                  <Field label="Discount">
                    <Input controlSize="compact" inputMode="decimal" value={line.discountAmount} onChange={(event) => setLine(index, "discountAmount", event.target.value)} />
                  </Field>
                  <Field label="Return">
                    <Input controlSize="compact" inputMode="decimal" value={line.returnAmount} onChange={(event) => setLine(index, "returnAmount", event.target.value)} />
                  </Field>
                  <Field label="Cancellation">
                    <Input controlSize="compact" inputMode="decimal" value={line.cancellationAmount} onChange={(event) => setLine(index, "cancellationAmount", event.target.value)} />
                  </Field>
                  <div className="ry-commerce-create-span ry-register-create-grid-span">
                    <Checkbox
                      label="Documented as commission eligible"
                      checked={line.commissionEligible}
                      onChange={(event) => setLine(index, "commissionEligible", event.target.checked)}
                    />
                  </div>
                  {lines.length > 1 ? (
                    <div className="ry-commerce-create-span ry-register-create-grid-span">
                      <Button type="button" variant="tertiary" size="compact" onClick={() => setLines((current) => current.filter((_, position) => position !== index))}>
                        Remove line
                      </Button>
                    </div>
                  ) : null}
                </div>
              </fieldset>
            ))}
          </div>
          </section>

          <RegisterCreateFooter className="ry-commerce-create-actions">
            <Button type="button" variant="secondary" size="compact" disabled={!canWrite || saving} onClick={() => setLines((current) => [...current, blankLine()])}>
              Add line
            </Button>
            <Button type="button" variant="tertiary" size="compact" disabled={saving} onClick={closeCreate}>
              Cancel
            </Button>
            <Button type="submit" size="compact" loading={saving} disabled={!canWrite}>
              {saving ? "Saving…" : "Save review-required Order"}
            </Button>
          </RegisterCreateFooter>
        </form>
      </Drawer>
    </div>
  );
}
