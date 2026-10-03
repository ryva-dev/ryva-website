import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  Drawer,
  EmptyState,
  ErrorState,
  EvidenceLabel,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select
} from "../../design-system";
import { RelationshipTrail } from "../relationship/RelationshipDetail";
import { displayBrandName } from "../brand/utils";
import {
  catalogTone,
  coreComparisonGaps,
  date,
  displayName,
  formatMoney,
  marginPercent,
  normalizeComparisonProduct,
  previewLeadTime,
  previewMarginValue,
  previewMoq,
  productInitials,
  readable,
  shown,
  type ProductRow
} from "./utils";

type ComparisonPayload = {
  comparison: ProductRow;
  products: ProductRow[];
  limitations: string[];
};

type DetailPayload = {
  product?: Record<string, unknown>;
  unknowns?: unknown[];
  evidence?: Array<Record<string, unknown>>;
  risks?: Array<Record<string, unknown>>;
};

type BuyerOption = {
  id: string;
  name: string;
};

type ComparisonRow = {
  key: string;
  label: string;
  render: (product: ProductRow) => ReactNode;
  compareValue?: (product: ProductRow) => string | number | null;
  distinction?: { pick: "lowest" | "highest"; label: string };
};

const comparisonAttributes: Array<{ key: string; label: string }> = [
  { key: "status", label: "Qualification" },
  { key: "category", label: "Category" },
  { key: "consumerPrice", label: "Consumer price" },
  { key: "wholesaleReadiness", label: "Wholesale readiness" },
  { key: "packagingReadiness", label: "Packaging readiness" },
  { key: "trendDirection", label: "Trend direction" },
  { key: "differentiation", label: "Differentiation" },
  { key: "physicalRetailPresence", label: "Physical retail presence" },
  { key: "reviewVolume", label: "Review volume" },
  { key: "reviewQualitySummary", label: "Review quality summary" },
  { key: "salesEvidenceSummary", label: "Sales evidence summary" },
  { key: "repeatPurchaseHypothesis", label: "Repeat purchase hypothesis" },
  { key: "inventoryNotes", label: "Inventory notes" },
  { key: "fulfillmentNotes", label: "Fulfillment notes" },
  { key: "returnsNotes", label: "Returns notes" },
  { key: "evidenceCount", label: "Current evidence count" },
  { key: "unknownCount", label: "Explicit unknowns" },
  { key: "riskCount", label: "Open risk flags" },
  { key: "lastReviewedAt", label: "Last reviewed" }
];

function attributeValue(product: ProductRow, attribute: { key: string; label: string }): string {
  const raw = product[attribute.key];
  if (raw === null || raw === undefined || raw === "") return "Unknown";
  if (attribute.key === "consumerPrice") return `${shown(raw)} ${shown(product.currency, "")}`.trim();
  if (attribute.key === "lastReviewedAt") return date(raw);
  if (["status", "wholesaleReadiness", "packagingReadiness", "trendDirection", "physicalRetailPresence"].includes(attribute.key)) {
    return readable(shown(raw));
  }
  return shown(raw);
}

function numericAmount(value: unknown): number | null {
  const raw = shown(value, "").trim();
  if (!raw || raw === "—") return null;
  const numeric = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function mutedValue(label: string): ReactNode {
  return <span className="ry-product-comparison-muted">{label}</span>;
}

function cellAction(productId: string, label: string): ReactNode {
  return (
    <Link className="ry-product-comparison-action" to={`/products/${productId}`}>
      {label}
    </Link>
  );
}

function moneyOrAction(product: ProductRow, value: unknown): ReactNode {
  const formatted = formatMoney(value, shown(product.currency, "USD"));
  if (formatted) return formatted;
  return cellAction(product.id, "Add price");
}

function hasPricing(product: ProductRow): boolean {
  return Boolean(
    formatMoney(product.wholesalePrice, shown(product.currency, "USD"))
    && formatMoney(product.consumerPrice, shown(product.currency, "USD"))
  );
}

function readinessChecks(product: ProductRow): Array<{ key: string; label: string; complete: boolean }> {
  const packaging = shown(product.packagingReadiness, "not_reviewed");
  return [
    { key: "pricing", label: "Pricing", complete: hasPricing(product) },
    { key: "images", label: "Images", complete: Boolean(shown(product.imageUrl, "").trim()) },
    { key: "description", label: "Description", complete: Boolean(shown(product.summary, "").trim()) },
    { key: "inventory", label: "Inventory", complete: Boolean(shown(product.inventoryNotes, "").trim()) },
    {
      key: "packaging",
      label: "Packaging",
      complete: packaging === "ready" || packaging === "conditional"
    }
  ];
}

function productMissingChips(product: ProductRow): string[] {
  const chips: string[] = [];
  const missingPricing = numericAmount(product.wholesalePrice) === null || numericAmount(product.consumerPrice) === null;
  if (missingPricing) chips.push("Pricing");
  if (!shown(product.moq, "").trim()) chips.push("MOQ");
  if (!shown(product.leadTime, "").trim()) chips.push("lead time");
  return chips;
}

type BuyerFitStatus =
  | "Match"
  | "Strong fit"
  | "Possible fit"
  | "Needs review"
  | "Not enough information"
  | "Restricted"
  | "None recorded";

function buyerFitStatus(label: BuyerFitStatus): ReactNode {
  return <span className={`ry-product-comparison-fit is-${label.toLowerCase().replace(/\s+/g, "-")}`}>{label}</span>;
}

function categoryBuyerFit(product: ProductRow): BuyerFitStatus {
  return shown(product.category, "").trim() ? "Possible fit" : "Not enough information";
}

function priceRangeBuyerFit(product: ProductRow): BuyerFitStatus {
  if (!formatMoney(product.consumerPrice, shown(product.currency, "USD"))) return "Not enough information";
  return "Possible fit";
}

function customerBuyerFit(product: ProductRow): BuyerFitStatus {
  return shown(product.idealRetailerType, "").trim() ? "Possible fit" : "None recorded";
}

function seasonalityBuyerFit(product: ProductRow): BuyerFitStatus {
  return shown(product.seasonality, "").trim() ? "Possible fit" : "None recorded";
}

function restrictionsBuyerFit(product: ProductRow): BuyerFitStatus {
  const value = shown(product.placementRestrictions, "").trim();
  if (!value) return "None recorded";
  return "Restricted";
}

function factualInterpretation(products: ProductRow[]): { title: string; detail: string } {
  if (products.length < 2) {
    return { title: "No clear commercial advantage yet", detail: "Select at least two products to compare." };
  }

  const facts: string[] = [];
  const margins = products
    .map((product) => ({ name: displayName(product.name), value: marginPercent(product) }))
    .filter((entry): entry is { name: string; value: number } => entry.value !== null);
  if (margins.length >= 2) {
    const best = Math.max(...margins.map((entry) => entry.value));
    const winners = margins.filter((entry) => entry.value === best);
    if (winners.length === 1 && new Set(margins.map((entry) => entry.value)).size > 1) {
      facts.push(`${winners[0]!.name} shows stronger margin`);
    }
  }

  const moqs = products
    .map((product) => ({ name: displayName(product.name), value: numericAmount(product.moq) }))
    .filter((entry): entry is { name: string; value: number } => entry.value !== null);
  if (moqs.length >= 2) {
    const best = Math.min(...moqs.map((entry) => entry.value));
    const winners = moqs.filter((entry) => entry.value === best);
    if (winners.length === 1 && new Set(moqs.map((entry) => entry.value)).size > 1) {
      facts.push(`${winners[0]!.name} has lower MOQ`);
    }
  }

  const leads = products
    .map((product) => ({ name: displayName(product.name), value: shown(product.leadTime, "").trim() }))
    .filter((entry) => entry.value);
  if (leads.length >= 2) {
    const numericLeads = leads
      .map((entry) => ({ name: entry.name, value: numericAmount(entry.value) }))
      .filter((entry): entry is { name: string; value: number } => entry.value !== null);
    if (numericLeads.length >= 2) {
      const best = Math.min(...numericLeads.map((entry) => entry.value));
      const winners = numericLeads.filter((entry) => entry.value === best);
      if (winners.length === 1 && new Set(numericLeads.map((entry) => entry.value)).size > 1) {
        facts.push(`${winners[0]!.name} has shorter lead time`);
      }
    }
  }

  const priced = products.filter((product) => formatMoney(product.consumerPrice, shown(product.currency, "USD")));
  if (priced.length === 1) {
    facts.push(`${displayName(priced[0]!.name)} has clearer buyer price detail`);
  }

  if (!facts.length) {
    return {
      title: "No clear commercial advantage yet",
      detail: "Stored values are aligned or incomplete across these products."
    };
  }

  return {
    title: facts[0]!.charAt(0).toUpperCase() + facts[0]!.slice(1) + (facts.length > 1 ? "." : ""),
    detail: facts.length > 1 ? `${facts.slice(1).join("; ")}.` : "Based only on stored commercial values."
  };
}

function ComparisonTable({
  label,
  products,
  rows
}: {
  label: string;
  products: ProductRow[];
  rows: ComparisonRow[];
}) {
  return (
    <div className="ry-table-wrap">
      <table className="ry-product-comparison-table">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            <th scope="col">Attribute</th>
            {products.map((product) => (
              <th scope="col" key={product.id}>{displayName(product.name)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const values = products.map((product) => (row.compareValue ? row.compareValue(product) : null));
            const known = values.filter((value) => value !== null && value !== "");
            const knownKeys = known.map(String);
            const allSame = known.length >= 2 && new Set(knownKeys).size === 1;
            const differs = known.length >= 2 && new Set(knownKeys).size > 1;
            const winners = new Set<string>();
            if (differs && row.distinction) {
              const numericEntries = products.flatMap((product, index) => {
                const value = values[index];
                const amount = typeof value === "number" ? value : numericAmount(value);
                return amount === null ? [] : [{ id: product.id, amount }];
              });
              if (numericEntries.length >= 2) {
                const target = row.distinction.pick === "lowest"
                  ? Math.min(...numericEntries.map((entry) => entry.amount))
                  : Math.max(...numericEntries.map((entry) => entry.amount));
                for (const entry of numericEntries) {
                  if (entry.amount === target) winners.add(entry.id);
                }
                if (winners.size === numericEntries.length) winners.clear();
              }
            }
            const rowClass = allSame ? "is-same" : differs ? "is-different" : undefined;
            return (
              <tr key={row.key} className={rowClass}>
                <th scope="row">{row.label}</th>
                {products.map((product) => (
                  <td key={`${product.id}-${row.key}`}>
                    <span className="ry-product-comparison-cell-stack">
                      {row.render(product)}
                      {winners.has(product.id) && row.distinction ? (
                        <span className="ry-product-comparison-distinction">{row.distinction.label}</span>
                      ) : null}
                    </span>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProductHeaders({
  products,
  onRemove
}: {
  products: ProductRow[];
  onRemove: (productId: string) => void;
}) {
  return (
    <div className="ry-product-comparison-sticky">
      <div
        className="ry-product-comparison-columns"
        style={{ ["--comparison-cols" as string]: products.length }}
      >
        {products.map((product) => {
          const label = displayName(product.name);
          const imageUrl = shown(product.imageUrl, "").trim();
          const brand = displayBrandName(product.brandName, "");
          const category = shown(product.category, "");
          const secondary = [brand, category].filter(Boolean).join(" · ");
          return (
            <div className="ry-product-comparison-column-header" key={product.id}>
              {imageUrl ? (
                <img className="ry-product-comparison-mark is-image" src={imageUrl} alt="" />
              ) : (
                <span className={`ry-product-comparison-mark ry-tone-${catalogTone(product)}`} aria-hidden="true">
                  {productInitials(label)}
                </span>
              )}
              <div className="ry-product-comparison-column-copy">
                <strong>{label}</strong>
                {secondary ? <span className="ry-product-comparison-column-meta">{secondary}</span> : null}
              </div>
              <button
                type="button"
                className="ry-product-comparison-remove"
                onClick={() => onRemove(product.id)}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProductComparisonCreatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const initialIds = useMemo(
    () => new URLSearchParams(location.search).get("ids")?.split(",").filter(Boolean) ?? [],
    [location.search]
  );
  const [selectedProducts, setSelectedProducts] = useState<ProductRow[]>([]);
  const [name, setName] = useState("Product diligence comparison");
  const [context, setContext] = useState({
    category: "",
    geography: "",
    channel: "physical retail",
    buyerType: "",
    period: "current"
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(initialIds.length));
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [buyerId, setBuyerId] = useState("");
  const [buyerEditing, setBuyerEditing] = useState(false);
  const [buyers, setBuyers] = useState<BuyerOption[]>([]);

  useEffect(() => {
    if (!initialIds.length) {
      setSelectedProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.all(initialIds.map((productId) => api<DetailPayload>(`/api/intelligence/products/${productId}`)))
      .then((results) => setSelectedProducts(results.map((result) => normalizeComparisonProduct(result))))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Selected Products could not be loaded."))
      .finally(() => setLoading(false));
  }, [initialIds]);

  useEffect(() => {
    let cancelled = false;
    void api<{ businesses?: BuyerOption[]; records?: BuyerOption[] }>("/api/intelligence/businesses?limit=100")
      .then((payload) => {
        if (cancelled) return;
        const list = payload.businesses ?? payload.records ?? [];
        setBuyers(list.map((row) => ({ id: shown(row.id, ""), name: displayName(row.name, "Buyer") })).filter((row) => row.id));
      })
      .catch(() => {
        void api<{ records?: BuyerOption[]; businesses?: BuyerOption[] }>("/api/records/business")
          .then((payload) => {
            if (cancelled) return;
            const list = payload.records ?? payload.businesses ?? [];
            setBuyers(list.map((row) => ({ id: shown(row.id, ""), name: displayName(row.name, "Buyer") })).filter((row) => row.id));
          })
          .catch(() => {
            if (!cancelled) setBuyers([]);
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectionValid = selectedProducts.length >= 2 && selectedProducts.length <= 4;
  const overLimit = selectedProducts.length > 4;
  const duplicateIds = new Set(initialIds).size !== initialIds.length;
  const coreIncomplete = useMemo(
    () => selectedProducts.length >= 2 && coreComparisonGaps(selectedProducts).length > 0,
    [selectedProducts]
  );
  const selectedBuyer = buyers.find((buyer) => buyer.id === buyerId);
  const interpretation = useMemo(() => {
    if (coreIncomplete) {
      return {
        title: "No clear commercial advantage yet",
        detail: selectedProducts.length === 2
          ? "Both products are missing the pricing and order details required for comparison."
          : "These products are missing the pricing and order details required for comparison."
      };
    }
    return factualInterpretation(selectedProducts);
  }, [coreIncomplete, selectedProducts]);

  function removeProduct(productId: string) {
    const nextIds = initialIds.filter((id) => id !== productId);
    const search = nextIds.length ? `?ids=${nextIds.join(",")}` : "";
    void navigate(`/products/compare${search}`);
  }

  function scrollToMissing() {
    const target = document.getElementById("comparison-commercial");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    target?.focus({ preventScroll: true });
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || !selectionValid) return;
    setSaving(true);
    setError("");
    try {
      const result = await api<ComparisonPayload>("/api/intelligence/comparisons", {
        method: "POST",
        body: { name, productIds: selectedProducts.map((product) => product.id), context }
      });
      const comparisonId = shown(result.comparison.id, "");
      if (comparisonId) {
        setFormOpen(false);
        void navigate(`/products/comparisons/${comparisonId}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Comparison could not be created.");
    } finally {
      setSaving(false);
    }
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
  }

  const commercialRows: ComparisonRow[] = [
    {
      key: "wholesale",
      label: "Wholesale price",
      render: (product) => moneyOrAction(product, product.wholesalePrice),
      compareValue: (product) => numericAmount(product.wholesalePrice),
      distinction: { pick: "lowest", label: "Lower cost" }
    },
    {
      key: "retail",
      label: "Suggested retail",
      render: (product) => moneyOrAction(product, product.consumerPrice),
      compareValue: (product) => numericAmount(product.consumerPrice)
    },
    {
      key: "margin",
      label: "Margin",
      render: (product) => {
        const margin = previewMarginValue(product);
        if (margin) return margin;
        if (!hasPricing(product)) return mutedValue("Awaiting pricing");
        return mutedValue("Not provided");
      },
      compareValue: (product) => marginPercent(product),
      distinction: { pick: "highest", label: "Higher margin" }
    },
    {
      key: "moq",
      label: "MOQ",
      render: (product) => {
        const value = previewMoq(product) || shown(product.moq, "").trim();
        if (value) return value;
        return cellAction(product.id, "Confirm MOQ");
      },
      compareValue: (product) => numericAmount(product.moq) ?? (shown(product.moq, "").trim() || null),
      distinction: { pick: "lowest", label: "Lower MOQ" }
    },
    {
      key: "lead",
      label: "Lead time",
      render: (product) => {
        const value = previewLeadTime(product) || shown(product.leadTime, "").trim();
        if (value) return value;
        return cellAction(product.id, "Confirm lead time");
      },
      compareValue: (product) => shown(product.leadTime, "").trim() || null
    }
  ];

  const buyerRows: ComparisonRow[] = [
    {
      key: "category",
      label: "Category",
      render: (product) => buyerFitStatus(categoryBuyerFit(product)),
      compareValue: (product) => categoryBuyerFit(product)
    },
    {
      key: "priceRange",
      label: "Price range",
      render: (product) => buyerFitStatus(priceRangeBuyerFit(product)),
      compareValue: (product) => priceRangeBuyerFit(product)
    },
    {
      key: "customer",
      label: "Customer",
      render: (product) => buyerFitStatus(customerBuyerFit(product)),
      compareValue: (product) => customerBuyerFit(product)
    },
    {
      key: "seasonality",
      label: "Seasonality",
      render: (product) => buyerFitStatus(seasonalityBuyerFit(product)),
      compareValue: (product) => seasonalityBuyerFit(product)
    },
    {
      key: "restrictions",
      label: "Restrictions",
      render: (product) => buyerFitStatus(restrictionsBuyerFit(product)),
      compareValue: (product) => restrictionsBuyerFit(product)
    }
  ];

  const criticalRiskProducts = selectedProducts.filter((product) => Number(product.criticalRiskCount ?? 0) > 0);
  const missingDataChips = selectedProducts
    .map((product) => {
      const chips = productMissingChips(product);
      if (!chips.length) return null;
      return { id: product.id, label: displayName(product.name), chips };
    })
    .filter((item): item is { id: string; label: string; chips: string[] } => Boolean(item));

  const headerActions = canWrite ? (
    <div className="ry-product-comparison-header-actions">
      {selectionValid && coreIncomplete ? (
        <Button onClick={scrollToMissing}>Review missing details</Button>
      ) : null}
      <Button
        variant={selectionValid && coreIncomplete ? "secondary" : "primary"}
        onClick={() => setFormOpen(true)}
        disabled={!selectionValid || duplicateIds || loading || overLimit}
      >
        Save comparison
      </Button>
    </div>
  ) : (
    <Button disabled>Read-only access</Button>
  );

  function renderBuyerContext() {
    if (selectedBuyer && !buyerEditing) {
      return (
        <div className="ry-product-comparison-buyer-context">
          <p>
            Comparing for <strong>{selectedBuyer.name}</strong>
          </p>
          <button type="button" className="ry-product-comparison-change-buyer" onClick={() => setBuyerEditing(true)}>
            Change buyer
          </button>
        </div>
      );
    }
    return (
      <div className="ry-product-comparison-buyer-context is-editing">
        <Field label="Compare for buyer" className="ry-product-comparison-buyer-field">
          <Select
            controlSize="compact"
            value={buyerId}
            onChange={(event) => {
              setBuyerId(event.target.value);
              setBuyerEditing(false);
            }}
          >
            <option value="">Select a buyer…</option>
            {buyers.map((buyer) => (
              <option key={buyer.id} value={buyer.id}>{buyer.name}</option>
            ))}
          </Select>
        </Field>
        {buyerEditing && buyerId ? (
          <button type="button" className="ry-product-comparison-change-buyer" onClick={() => setBuyerEditing(false)}>
            Cancel
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="page ry-product-page ry-product-comparison-create">
      <RelationshipTrail items={[{ label: "Products", to: "/products" }, { label: "Compare products" }]} />
      <PageHeader
        title="Compare products"
        description="Review pricing, margin, readiness, and wholesale fit side by side."
        action={headerActions}
      />
      <p className="ry-product-comparison-lede">Review pricing, margin, readiness, and wholesale fit side by side.</p>
      {!canWrite ? <Alert tone="warning" title="Read-only access">Comparison creation is unavailable in this session.</Alert> : null}
      {duplicateIds ? <Alert tone="warning" title="Duplicate selection">Remove duplicate Product selections before saving a comparison.</Alert> : null}
      {overLimit ? (
        <Alert tone="warning" title="Too many products">
          More than four products becomes hard to read. Remove one to continue.
        </Alert>
      ) : null}
      {loading ? <LoadingState label="Loading selected Products" /> : null}
      {error && !formOpen ? <ErrorState message={error} /> : null}

      {!loading && selectedProducts.length === 0 ? (
        <EmptyState
          compact
          title="No products selected"
          description="Select 2–4 products from the Product register to begin comparison."
          action={<Link className="ry-button ry-button-secondary" to="/products">Open Product register</Link>}
        />
      ) : null}

      {!loading && selectedProducts.length === 1 ? (
        <div className="ry-product-comparison-workspace">
          <Alert tone="warning" title="Select at least one more product to begin comparison.">
            <Link to="/products">Back to products</Link>
          </Alert>
          {renderBuyerContext()}
          <ProductHeaders products={selectedProducts} onRemove={removeProduct} />
        </div>
      ) : null}

      {!loading && selectedProducts.length >= 2 ? (
        <div className="ry-product-comparison-workspace">
          {selectedProducts.length <= 4 ? renderBuyerContext() : null}

          <ProductHeaders products={selectedProducts} onRemove={removeProduct} />

          {selectedProducts.length <= 4 ? (
            <>
              <div className="ry-product-comparison-columns ry-product-comparison-column-actions" style={{ ["--comparison-cols" as string]: selectedProducts.length }}>
                {selectedProducts.map((product) => (
                  <Link key={product.id} className="ry-product-comparison-complete-link" to={`/products/${product.id}`}>
                    Complete product details
                  </Link>
                ))}
              </div>

              <div className={`ry-product-comparison-summary ${coreIncomplete ? "is-incomplete" : ""}`}>
                <p className="ry-product-comparison-summary-title">{interpretation.title}</p>
                <p className="ry-product-comparison-summary-detail">{interpretation.detail}</p>
              </div>

              <section
                id="comparison-commercial"
                className="ry-product-comparison-section"
                aria-label="Commercial fit"
                tabIndex={-1}
              >
                <h2>Commercial fit</h2>
                <ComparisonTable label="Commercial fit" products={selectedProducts} rows={commercialRows} />
              </section>

              <section className="ry-product-comparison-section" aria-label="Buyer fit">
                <h2>Buyer fit</h2>
                {buyerId ? (
                  <ComparisonTable label="Buyer fit" products={selectedProducts} rows={buyerRows} />
                ) : (
                  <p className="ry-product-comparison-buyer-empty">Select a buyer to evaluate placement fit.</p>
                )}
              </section>

              <section className="ry-product-comparison-section" aria-label="Product readiness">
                <h2>Product readiness</h2>
                <div
                  className="ry-product-comparison-columns ry-product-comparison-readiness"
                  style={{ ["--comparison-cols" as string]: selectedProducts.length }}
                >
                  {selectedProducts.map((product) => {
                    const checks = readinessChecks(product);
                    const completeCount = checks.filter((check) => check.complete).length;
                    return (
                      <article className="ry-product-comparison-readiness-card" key={product.id}>
                        <h3>{displayName(product.name)}</h3>
                        <p className="ry-product-comparison-readiness-count">
                          {completeCount} of {checks.length} readiness checks complete
                        </p>
                        <p className="ry-product-comparison-readiness-list">
                          {checks.map((check) => check.label).join(" · ")}
                        </p>
                        <Link className="ry-product-comparison-readiness-link" to={`/products/${product.id}`}>
                          Review product →
                        </Link>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="ry-product-comparison-section" aria-label="Risks and missing information">
                <h2>Risks</h2>
                <div className="ry-product-comparison-risks">
                  {coreIncomplete ? (
                    <>
                      <p className="ry-product-comparison-risks-blocked">Comparison blocked by incomplete data</p>
                      <ul className="ry-product-comparison-risk-chips">
                        {missingDataChips.map((item) => (
                          <li key={item.id}>
                            <span className="ry-product-comparison-risk-chip">
                              {item.label}: {item.chips.join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <>
                      {criticalRiskProducts.length ? (
                        <ul className="ry-product-comparison-risks-critical">
                          {criticalRiskProducts.map((product) => {
                            const count = Number(product.criticalRiskCount ?? 0);
                            return (
                              <li key={product.id}>
                                {displayName(product.name)}: {count === 1 ? "1 critical risk" : `${count} critical risks`}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="ry-product-comparison-risks-none">No critical risks detected.</p>
                      )}
                    </>
                  )}
                </div>
              </section>

              {canWrite ? (
                <div className="ry-product-comparison-footer-actions">
                  <Button
                    variant={coreIncomplete ? "secondary" : "primary"}
                    onClick={() => setFormOpen(true)}
                    disabled={!selectionValid || duplicateIds || overLimit}
                  >
                    Save comparison
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <Drawer
        open={formOpen}
        title="Comparison details"
        description="Name the comparison and record the shared context for these products."
        onClose={closeForm}
        size="standard"
        className="ry-product-comparison-drawer"
      >
        <form className="ry-product-comparison-form" aria-label="Comparison details" onSubmit={(event) => void create(event)}>
          {error ? <ErrorState message={error} /> : null}
          <div className="ry-product-comparison-form-grid">
            <Field label="Comparison name" className="ry-product-comparison-form-span">
              <Input
                required
                controlSize="compact"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canWrite || saving}
              />
            </Field>
            <Field label="Category">
              <Input
                controlSize="compact"
                value={context.category}
                onChange={(event) => setContext((current) => ({ ...current, category: event.target.value }))}
                disabled={!canWrite || saving}
              />
            </Field>
            <Field label="Geography">
              <Input
                controlSize="compact"
                value={context.geography}
                onChange={(event) => setContext((current) => ({ ...current, geography: event.target.value }))}
                disabled={!canWrite || saving}
              />
            </Field>
            <Field label="Channel">
              <Input
                required
                controlSize="compact"
                value={context.channel}
                onChange={(event) => setContext((current) => ({ ...current, channel: event.target.value }))}
                disabled={!canWrite || saving}
              />
            </Field>
            <Field label="Buyer type">
              <Input
                controlSize="compact"
                value={context.buyerType}
                onChange={(event) => setContext((current) => ({ ...current, buyerType: event.target.value }))}
                disabled={!canWrite || saving}
              />
            </Field>
            <Field label="Period" className="ry-product-comparison-form-span">
              <Input
                required
                controlSize="compact"
                value={context.period}
                onChange={(event) => setContext((current) => ({ ...current, period: event.target.value }))}
                disabled={!canWrite || saving}
              />
            </Field>
          </div>
          <div className="ry-product-comparison-form-actions">
            <Button type="button" variant="secondary" size="compact" disabled={saving} onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" size="compact" loading={saving} disabled={!canWrite || !selectionValid || duplicateIds}>
              {saving ? "Saving…" : "Save comparison"}
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}

export function ProductComparisonDetailPage() {
  const comparisonId = useParams().comparisonId ?? "";
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [comparison, setComparison] = useState<ComparisonPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileProductId, setMobileProductId] = useState("");

  useEffect(() => {
    setLoading(true);
    void api<ComparisonPayload>(`/api/intelligence/comparisons/${comparisonId}`)
      .then((payload) => {
        setComparison(payload);
        const first = payload.products[0]?.id;
        if (first) setMobileProductId(first);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Comparison unavailable."))
      .finally(() => setLoading(false));
  }, [comparisonId]);

  const products = useMemo(() => comparison?.products ?? [], [comparison?.products]);
  const header = comparison?.comparison;
  const limitations = comparison?.limitations ?? [];
  const mobileProduct = products.find((product) => product.id === mobileProductId) ?? products[0];

  const differingAttributes = useMemo(() => comparisonAttributes.filter((attribute) => {
    const values = new Set(products.map((product) => attributeValue(product, attribute)));
    return values.size > 1;
  }), [products]);

  if (loading) {
    return (
      <div className="page ry-product-page">
        <LoadingState label="Loading Product comparison" />
      </div>
    );
  }

  if (!comparison || error) {
    return (
      <div className="page ry-product-page">
        <ErrorState message={error || "Comparison unavailable."} />
      </div>
    );
  }

  return (
    <div className="page ry-product-page ry-product-comparison-detail">
      <RelationshipTrail items={[
        { label: "Products", to: "/products" },
        { label: shown(header?.name, "Product comparison") }
      ]} />
      <PageHeader
        eyebrow="Product Intelligence · No numerical score"
        title={shown(header?.name, "Product comparison")}
        description="Unknowns remain Unknown. Evidence counts are not converted into rankings or superiority claims."
      />
      {!canWrite ? <Alert tone="warning" title="Read-only comparison">You may inspect this comparison, but cannot record a comparison decision in this session.</Alert> : null}
      <section className="ry-product-comparison-context panel">
        <h2>Comparison context</h2>
        <dl className="ry-relationship-facts">
          <div><dt>Category</dt><dd>{shown((header?.context as Record<string, unknown> | undefined)?.category, "Not specified")}</dd></div>
          <div><dt>Geography</dt><dd>{shown((header?.context as Record<string, unknown> | undefined)?.geography, "Not specified")}</dd></div>
          <div><dt>Channel</dt><dd>{shown((header?.context as Record<string, unknown> | undefined)?.channel, "Not specified")}</dd></div>
          <div><dt>Buyer type</dt><dd>{shown((header?.context as Record<string, unknown> | undefined)?.buyerType, "Not specified")}</dd></div>
          <div><dt>Period</dt><dd>{shown((header?.context as Record<string, unknown> | undefined)?.period, "Not specified")}</dd></div>
        </dl>
      </section>

      <section className="ry-product-comparison-table panel" aria-label="Product comparison matrix">
        <h2>Aligned attributes</h2>
        <div className="ry-product-comparison-desktop">
          <div className="ry-table-wrap">
            <table>
              <caption className="sr-only">Product comparison for {shown(header?.name)}</caption>
              <thead>
                <tr>
                  <th scope="col">Attribute</th>
                  {products.map((product) => (
                    <th scope="col" key={product.id}>
                      <Link to={`/products/${product.id}`}>{product.name}</Link>
                      <small>{displayBrandName(product.brandName)}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonAttributes.map((attribute) => (
                  <tr key={attribute.key} className={differingAttributes.some((item) => item.key === attribute.key) ? "ry-product-comparison-diff" : undefined}>
                    <th scope="row">{attribute.label}</th>
                    {products.map((product) => (
                      <td key={`${product.id}-${attribute.key}`}>
                        {attribute.key === "unknownCount" && Number(product.unknownCount ?? 0) > 0 ? (
                          <EvidenceLabel value="unknown" confidence="insufficient" />
                        ) : null}
                        <span>{attributeValue(product, attribute)}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ry-product-comparison-mobile" aria-label="Mobile Product comparison">
          <Field label="Focus Product">
            <Select value={mobileProduct?.id ?? ""} onChange={(event) => setMobileProductId(event.target.value)}>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </Select>
          </Field>
          {mobileProduct ? (
            <dl className="ry-product-comparison-mobile-attributes">
              {comparisonAttributes.map((attribute) => (
                <div key={attribute.key}>
                  <dt>{attribute.label}</dt>
                  <dd>
                    <span className="sr-only">{mobileProduct.name}: </span>
                    {attributeValue(mobileProduct, attribute)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <section aria-label="Attribute differences across Products">
            <h3>Where Products differ</h3>
            {differingAttributes.length ? (
              <ul className="ry-product-comparison-diff-list">
                {differingAttributes.map((attribute) => (
                  <li key={attribute.key}>
                    <strong>{attribute.label}</strong>
                    <ul>
                      {products.map((product) => (
                        <li key={`${attribute.key}-${product.id}`}>
                          <span>{product.name}: </span>
                          <span>{attributeValue(product, attribute)}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No stored attribute differences were detected across the compared Products.</p>
            )}
          </section>
        </div>
      </section>

      <section className="panel">
        <h2>Interpretation limits</h2>
        <ul>{limitations.map((item) => <li key={item}>{item}</li>)}</ul>
        <Alert title="No ranking or recommendation">This comparison does not establish Product superiority, Buyer fit, outreach permission, or representation authority.</Alert>
      </section>
    </div>
  );
}
