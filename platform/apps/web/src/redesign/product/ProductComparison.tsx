import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  EvidenceLabel,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusLabel
} from "../../design-system";
import { RelationshipTrail } from "../relationship/RelationshipDetail";
import { date, readable, shown, type ProductRow } from "./utils";

type ComparisonPayload = {
  comparison: ProductRow;
  products: ProductRow[];
  limitations: string[];
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

  useEffect(() => {
    if (!initialIds.length) return;
    setLoading(true);
    void Promise.all(initialIds.map((productId) => api<{ product: ProductRow }>(`/api/intelligence/products/${productId}`)))
      .then((results) => setSelectedProducts(results.map((result) => result.product)))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Selected Products could not be loaded."))
      .finally(() => setLoading(false));
  }, [initialIds]);

  const selectionValid = selectedProducts.length >= 2 && selectedProducts.length <= 4;
  const duplicateIds = new Set(initialIds).size !== initialIds.length;

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
      if (comparisonId) void navigate(`/products/comparisons/${comparisonId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Comparison could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page ry-product-page ry-product-comparison-create">
      <RelationshipTrail items={[{ label: "Products", to: "/products" }, { label: "Create comparison" }]} />
      <PageHeader
        eyebrow="Product Intelligence"
        title="Create comparison"
        description="Align two to four Products in one explicit context. No numerical Product Score or ranking is calculated."
      />
      <Alert title="Comparison limits">Unknown values remain Unknown. Every conclusion requires source inspection and human judgment.</Alert>
      {!canWrite ? <Alert tone="warning" title="Read-only access">Comparison creation is unavailable in this session.</Alert> : null}
      {duplicateIds ? <Alert tone="warning" title="Duplicate selection">Remove duplicate Product selections before creating a comparison.</Alert> : null}
      {loading ? <LoadingState label="Loading selected Products" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading ? (
        <>
          <section className="ry-product-comparison-selection" aria-label="Selected Products">
            <h2>Selected Products ({selectedProducts.length})</h2>
            {selectedProducts.length ? (
              <ul className="ry-product-comparison-product-list">
                {selectedProducts.map((product) => (
                  <li key={product.id}>
                    <strong>{product.name}</strong>
                    <span>{shown(product.brandName)} · {shown(product.category)}</span>
                    <StatusLabel value={shown(product.status, "discovered")} />
                    <EvidenceLabel value={Number(product.unknownCount ?? 0) > 0 ? "unknown" : "direct_evidence"} confidence={Number(product.unknownCount ?? 0) > 0 ? "insufficient" : "limited"} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No Products selected" description="Select 2–4 Products from the Product register before creating a comparison." action={<Link className="ry-button ry-button-secondary" to="/products">Open Product register</Link>} />
            )}
            {!selectionValid && selectedProducts.length ? (
              <Alert tone="warning" title="Selection incomplete">Comparisons require between 2 and 4 Products with distinct identities.</Alert>
            ) : null}
          </section>
          <section className="panel">
            <form className="ry-product-comparison-form" onSubmit={(event) => void create(event)}>
              <Field label="Name"><Input required value={name} onChange={(event) => setName(event.target.value)} disabled={!canWrite} /></Field>
              {(["category", "geography", "channel", "buyerType", "period"] as const).map((key) => (
                <Field key={key} label={readable(key)}>
                  <Input
                    required={key === "channel" || key === "period"}
                    value={context[key]}
                    onChange={(event) => setContext((current) => ({ ...current, [key]: event.target.value }))}
                    disabled={!canWrite}
                  />
                </Field>
              ))}
              <Button type="submit" loading={saving} disabled={!canWrite || !selectionValid || duplicateIds}>Create aligned comparison</Button>
            </form>
          </section>
        </>
      ) : null}
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
                      <small>{shown(product.brandName)}</small>
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
