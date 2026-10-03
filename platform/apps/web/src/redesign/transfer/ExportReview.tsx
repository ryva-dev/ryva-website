import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import {
  Alert,
  Button,
  Checkbox,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Select,
  StatusLabel,
  Table
} from "../../design-system";
import { ReviewSection } from "../consequential/ConsequentialReview";

type Capabilities = { scopes: string[]; formats: string[]; documentPolicy: string };
type ExportResult = { id: string; status: string; digest: string; manifest?: { rowCount: number; generatedAt: string; scopes: string[] } };
type ExportFormat = "json" | "csv_bundle";

const SCOPE_LABELS: Record<string, string> = {
  profile: "Profile",
  products: "Products",
  brands: "Brands",
  businesses: "Businesses & Buyers",
  contacts: "Contacts",
  sources: "Sources",
  evidence: "Evidence",
  tasks: "Tasks",
  representation_opportunities: "Representation",
  placement_opportunities: "Placements",
  activity: "Activity",
  accounts: "Accounts",
  protected_accounts: "Protection",
  orders: "Orders",
  reorders: "Reorders",
  commissions: "Commissions",
  analytics: "Analytics",
  audit: "Audit history",
  documents: "Documents"
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  json: "Portable JSON",
  csv_bundle: "CSV bundle"
};

function scopeLabel(scope: string): string {
  return SCOPE_LABELS[scope]
    ?? scope.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatLabel(format: string): string {
  if (format === "json" || format === "csv_bundle") return FORMAT_LABELS[format];
  return format.replaceAll("_", " ");
}

function summarizeScopes(selected: string[]): string {
  if (!selected.length) return "None selected";
  const labels = selected.map(scopeLabel);
  if (labels.length <= 4) return labels.join(", ");
  return `${labels.slice(0, 4).join(", ")} +${labels.length - 4} more`;
}

export function ExportReviewPage() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [format, setFormat] = useState<ExportFormat>("json");
  const [includeDocuments, setIncludeDocuments] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [history, setHistory] = useState<ExportResult[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const permittedScopes = capabilities?.scopes ?? [];
  const availableFormats = useMemo(
    () => (capabilities?.formats ?? []).filter((item): item is ExportFormat => item === "json" || item === "csv_bundle"),
    [capabilities]
  );

  useEffect(() => {
    void api<Capabilities>("/api/data-exports/capabilities")
      .then((next) => {
        setCapabilities(next);
        const firstFormat = next.formats.find((item): item is ExportFormat => item === "json" || item === "csv_bundle");
        if (firstFormat) setFormat(firstFormat);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Export controls could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!result || !["queued", "generating"].includes(result.status)) return;
    const timer = window.setInterval(() => {
      void api<ExportResult>(`/api/data-exports/${result.id}`).then((next) => {
        setResult(next);
        setHistory((current) => [next, ...current.filter((item) => item.id !== next.id)]);
      }).catch((caught) => setError(caught instanceof Error ? caught.message : "Export status could not be refreshed."));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [result]);

  async function createExport() {
    setWorking(true);
    setError("");
    try {
      const next = await api<ExportResult>("/api/data-exports", { method: "POST", body: { scopes: selected, format, includeDocuments } });
      setResult(next);
      setHistory((current) => [next, ...current.filter((item) => item.id !== next.id)]);
      setConfirmOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The export could not be generated.");
      setConfirmOpen(false);
    } finally {
      setWorking(false);
    }
  }

  function selectAllPermitted() {
    setSelected([...permittedScopes]);
  }

  function clearSelection() {
    setSelected([]);
  }

  return (
    <div className="page ry-transfer-page">
      <PageHeader
        eyebrow="Data transfer"
        title="Secure exports"
        description="Create an audited export of selected Ryva data."
      />
      {loading ? <LoadingState label="Loading export controls" /> : null}
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => window.location.reload()}>Try again</Button>} /> : null}
      {capabilities ? (
        <>
          <ReviewSection
            eyebrow="Scope"
            title="Select data"
            description="Choose the data you want included in this export."
          >
            <div className="ry-transfer-scope-toolbar">
              <Button type="button" variant="tertiary" size="compact" onClick={selectAllPermitted}>
                Select all
              </Button>
              <Button type="button" variant="tertiary" size="compact" onClick={clearSelection} disabled={!selected.length}>
                Clear
              </Button>
            </div>
            <div className="ry-transfer-scope-grid">
              {permittedScopes.map((scope) => (
                <Checkbox
                  key={scope}
                  label={scopeLabel(scope)}
                  checked={selected.includes(scope)}
                  onChange={(event) => setSelected((current) => (
                    event.target.checked
                      ? [...current, scope]
                      : current.filter((item) => item !== scope)
                  ))}
                />
              ))}
            </div>
          </ReviewSection>

          <ReviewSection
            eyebrow="Package"
            title="Package format"
            description="Choose how the exported data will be packaged."
          >
            {availableFormats.length <= 1 ? (
              <div className="ry-transfer-readonly-field">
                <span className="ry-field-label">Package format</span>
                <p>{formatLabel(availableFormats[0] ?? format)}</p>
              </div>
            ) : (
              <Field label="Package format">
                <Select
                  value={format}
                  onChange={(event) => setFormat(event.target.value as ExportFormat)}
                >
                  {availableFormats.map((item) => (
                    <option key={item} value={item}>{formatLabel(item)}</option>
                  ))}
                </Select>
              </Field>
            )}
          </ReviewSection>

          <ReviewSection
            eyebrow="Documents"
            title="Document files"
            description="Document metadata is included normally. Original files require additional authorization and review."
          >
            <Checkbox
              label="Include document files"
              checked={includeDocuments}
              onChange={(event) => setIncludeDocuments(event.target.checked)}
            />
            <Alert tone="info" title="Document files require review">
              Document metadata can be exported immediately. Original files require separate authorization before they can be included.
            </Alert>
          </ReviewSection>

          <ReviewSection
            eyebrow="Review"
            title="Review export"
            description="Confirm what will be included before generating the package."
          >
            <dl className="ry-transfer-review-facts">
              <div>
                <dt>Data selected</dt>
                <dd>{summarizeScopes(selected)}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{formatLabel(format)}</dd>
              </div>
              <div>
                <dt>Document files</dt>
                <dd>{includeDocuments ? "Requested for review" : "Not requested"}</dd>
              </div>
            </dl>
            <Button disabled={!selected.length || working} onClick={() => setConfirmOpen(true)}>
              Generate export
            </Button>
          </ReviewSection>
        </>
      ) : null}

      {result ? (
        <ReviewSection
          eyebrow="Current export"
          title={result.status === "ready" ? "Export ready" : "Export queued"}
          description="Export generation and access are audit recorded."
        >
          <StatusLabel value={result.status} />
          {result.status === "ready" && result.manifest ? (
            <>
              <p>
                {result.manifest.rowCount} rows across {result.manifest.scopes.length} scopes.
                {" "}Integrity digest: <code>{result.digest}</code>
              </p>
              <a className="ry-button ry-button-primary" href={`/api/data-exports/${result.id}/download`}>
                Download export
              </a>
            </>
          ) : (
            <p>The durable worker will generate this package. It is safe to leave this page; failures remain retryable in Operations.</p>
          )}
        </ReviewSection>
      ) : null}

      <ReviewSection
        eyebrow="History"
        title="Export history"
        description="Recent exports appear here with their status and availability."
      >
        {history.length ? (
          <Table caption="Export history">
            <thead>
              <tr>
                <th>Export</th>
                <th>Status</th>
                <th>Digest</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td><StatusLabel value={item.status} /></td>
                  <td><code>{item.digest}</code></td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No exports yet" compact description="Generated exports will appear here." />
        )}
      </ReviewSection>

      <ConfirmationDialog
        open={confirmOpen}
        title="Confirm export"
        description={`Generate a ${formatLabel(format)} export for ${selected.length} selected data set${selected.length === 1 ? "" : "s"}.`}
        consequence={
          <p>
            The package is workspace-scoped, audit recorded, and generated asynchronously.
            Document inclusion remains subject to policy review.
          </p>
        }
        confirmLabel="Generate export"
        processing={working}
        onConfirm={() => void createExport()}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
