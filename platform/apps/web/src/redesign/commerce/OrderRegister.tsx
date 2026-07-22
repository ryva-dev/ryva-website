import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  Checkbox,
  DataRow,
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
  RegisterMobileList,
  RegisterMobileRow,
  RegisterSavedViews,
  type RegisterSort
} from "../register/Register";
import { CommercialSubnav } from "./CommercialSubnav";
import {
  blankLine,
  currency,
  dateShown,
  orderPlacementStages,
  orderStatuses,
  readable,
  shown,
  type OrderLine,
  type Row
} from "./utils";

export function OrderRegisterPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [orders, setOrders] = useState<Row[]>([]);
  const [placements, setPlacements] = useState<Row[]>([]);
  const [documents, setDocuments] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [placementId, setPlacementId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [documentId, setDocumentId] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([blankLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sort: RegisterSort = { field: "orderDate", direction: "desc" };

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

  function setLine(index: number, key: keyof OrderLine, value: string | boolean) {
    setLines((current) => current.map((line, position) => position === index ? { ...line, [key]: value } : line));
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError("");
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
      void navigate(`/orders/${result.order.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Order could not be recorded.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page ry-register-page ry-commerce-page">
      <CommercialSubnav />
      <PageHeader
        eyebrow="Verified commercial records"
        title="Orders"
        description="Only documented, human-verified Orders create Accounts and estimated Commissions. Drafts and projections are excluded from actual totals."
        action={<a className="ry-button ry-button-secondary" href="/api/commercial-export/order">Export CSV</a>}
      />
      {!canWrite ? <Alert tone="warning" title="Read-only Order register">{session?.access.reason ?? "This session cannot record Orders."}</Alert> : null}
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}

      <section className="ry-register-surface" aria-label="Orders register">
        <div className="ry-register-commandbar">
          <RegisterSavedViews recordType="order" filters={{ status }} sort={sort} canWrite={Boolean(canWrite)} onApply={(filters) => setStatus(filters.status ?? "")} />
          <FilterBar>
            <Field label="Order status">
              <Select controlSize="compact" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All statuses</option>
                {orderStatuses.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
              </Select>
            </Field>
          </FilterBar>
        </div>
        {loading ? <LoadingState label="Loading Orders and source records" /> : orders.length === 0 ? (
          <EmptyState description="No Orders yet. Record a real source-backed opening Order above." />
        ) : (
          <>
            <Table caption="Order reconciliation">
              <thead><tr><th>Order</th><th>Relationship</th><th>Gross</th><th>Net commissionable</th><th>Verification</th><th>Payment</th><th><span className="sr-only">Reconcile</span></th></tr></thead>
              <tbody>{orders.map((item) => (
                <DataRow key={item.id}>
                  <td><strong>{shown(item.orderNumber)}</strong><small>{dateShown(item.orderDate)} · {readable(shown(item.orderType))}</small></td>
                  <td>{shown(item.brandName)}<small>{shown(item.businessName)}</small></td>
                  <td>{currency(item.wholesaleGross, item.currency)}</td>
                  <td>{currency(item.netCommissionable, item.currency)}</td>
                  <td><StatusLabel value={shown(item.verificationStatus)} /></td>
                  <td><StatusLabel value={shown(item.paymentStatus)} /></td>
                  <td><Link to={`/orders/${item.id}`}>Reconcile</Link></td>
                </DataRow>
              ))}</tbody>
            </Table>
            <RegisterMobileList label="Orders">
              {orders.map((item) => <RegisterMobileRow key={item.id} title={shown(item.orderNumber)} meta={`${shown(item.brandName)} → ${shown(item.businessName)} · ${currency(item.netCommissionable, item.currency)}`} status={<StatusLabel value={shown(item.verificationStatus)} />} onOpen={() => void navigate(`/orders/${item.id}`)} openLabel={`Reconcile ${shown(item.orderNumber)}`} />)}
            </RegisterMobileList>
          </>
        )}
      </section>

      <section className="panel ry-commerce-create-inline">
        <h2>Record an opening Order</h2>
        <p>Record only a real Order supported by a clean source document. Saving creates a review-required record, not a verified commercial outcome.</p>
        <form onSubmit={(event) => void create(event)}>
          <div className="form-grid">
            <Field label="Order-discussion Placement">
              <Select required value={placementId} onChange={(event) => setPlacementId(event.target.value)} disabled={!canWrite}>
                <option value="">Select Placement</option>
                {placements.filter((item) => orderPlacementStages.includes(shown(item.stage) as typeof orderPlacementStages[number])).map((item) => <option value={item.id} key={item.id}>{shown(item.brandName)} → {shown(item.businessName)}</option>)}
              </Select>
            </Field>
            <Field label="Clean source document">
              <Select required value={documentId} onChange={(event) => setDocumentId(event.target.value)} disabled={!canWrite}>
                <option value="">Select verified source</option>
                {documents.filter((item) => item.status === "active" && item.scanStatus === "clean").map((item) => <option value={item.id} key={item.id}>{shown(item.name)}</option>)}
              </Select>
            </Field>
            <Field label="Order number"><Input required value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} disabled={!canWrite} /></Field>
            <Field label="External reference"><Input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} disabled={!canWrite} /></Field>
            <Field label="Order date"><Input type="date" required value={orderDate} onChange={(event) => setOrderDate(event.target.value)} disabled={!canWrite} /></Field>
            <Field label="Currency"><Input required pattern="[A-Z]{3}" value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())} disabled={!canWrite} /></Field>
          </div>
          <h3>Line items</h3>
          {lines.map((line, index) => (
            <fieldset className="line-item-grid" key={index} disabled={!canWrite}>
              <legend>Line {index + 1}</legend>
              <Field label="Product ID"><Input required value={line.productId} onChange={(event) => setLine(index, "productId", event.target.value)} /></Field>
              <Field label="Description"><Input required value={line.description} onChange={(event) => setLine(index, "description", event.target.value)} /></Field>
              <Field label="Quantity"><Input required inputMode="decimal" value={line.quantity} onChange={(event) => setLine(index, "quantity", event.target.value)} /></Field>
              <Field label="Unit wholesale"><Input required inputMode="decimal" value={line.unitWholesalePrice} onChange={(event) => setLine(index, "unitWholesalePrice", event.target.value)} /></Field>
              <Field label="Gross"><Input required inputMode="decimal" value={line.grossAmount} onChange={(event) => setLine(index, "grossAmount", event.target.value)} /></Field>
              <Field label="Discount"><Input inputMode="decimal" value={line.discountAmount} onChange={(event) => setLine(index, "discountAmount", event.target.value)} /></Field>
              <Field label="Return"><Input inputMode="decimal" value={line.returnAmount} onChange={(event) => setLine(index, "returnAmount", event.target.value)} /></Field>
              <Field label="Cancellation"><Input inputMode="decimal" value={line.cancellationAmount} onChange={(event) => setLine(index, "cancellationAmount", event.target.value)} /></Field>
              <Checkbox label="Documented as commission eligible" checked={line.commissionEligible} onChange={(event) => setLine(index, "commissionEligible", event.target.checked)} />
              {lines.length > 1 ? <Button type="button" variant="tertiary" onClick={() => setLines((current) => current.filter((_, position) => position !== index))}>Remove line</Button> : null}
            </fieldset>
          ))}
          <div className="button-row">
            <Button type="button" variant="secondary" disabled={!canWrite} onClick={() => setLines((current) => [...current, blankLine()])}>Add line</Button>
            <Button type="submit" loading={saving} disabled={!canWrite}>Save review-required Order</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
