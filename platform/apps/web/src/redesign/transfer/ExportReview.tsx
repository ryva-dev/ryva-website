import { useEffect, useState } from "react";
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

export function ExportReviewPage() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [format, setFormat] = useState<"json" | "csv_bundle">("json");
  const [includeDocuments, setIncludeDocuments] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [history, setHistory] = useState<ExportResult[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    void api<Capabilities>("/api/data-exports/capabilities")
      .then(setCapabilities)
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

  return (
    <div className="page ry-transfer-page">
      <PageHeader eyebrow="Data portability" title="Secure exports" description="Create a workspace-scoped, audited package with stable identifiers and an integrity digest." />
      {loading ? <LoadingState label="Loading export controls" /> : null}
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => window.location.reload()}>Try again</Button>} /> : null}
      {capabilities ? <>
        <ReviewSection eyebrow="Scope" title="Select data" description="Choose the workspace data scopes included in the audited package.">
          <div className="ry-transfer-scope-grid">
            {capabilities.scopes.map((scope) => <Checkbox key={scope} label={scope.replaceAll("_", " ")} checked={selected.includes(scope)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, scope] : current.filter((item) => item !== scope))} />)}
          </div>
          <div className="ry-transfer-grid">
            <Field label="Package format"><Select value={format} onChange={(event) => setFormat(event.target.value as "json" | "csv_bundle")}><option value="json">Portable JSON</option><option value="csv_bundle">CSV bundle manifest</option></Select></Field>
            <Checkbox label="Request document inclusion review" checked={includeDocuments} onChange={(event) => setIncludeDocuments(event.target.checked)} />
          </div>
          <Alert tone="info" title="Document policy">{capabilities.documentPolicy}</Alert>
        </ReviewSection>
        <ReviewSection eyebrow="Review" title="Generate audited export" description="The selected scope, format, and document request are recorded with this export.">
          <dl className="ry-transfer-review-facts"><div><dt>Scopes</dt><dd>{selected.length ? selected.map((scope) => scope.replaceAll("_", " ")).join(", ") : "No scopes selected"}</dd></div><div><dt>Format</dt><dd>{format === "json" ? "Portable JSON" : "CSV bundle manifest"}</dd></div></dl>
          <Button disabled={!selected.length || working} onClick={() => setConfirmOpen(true)}>Generate audited export</Button>
        </ReviewSection>
      </> : null}
      {result ? <ReviewSection eyebrow="Current export" title={result.status === "ready" ? "Export ready" : "Export queued"} description="Export generation and access are audit recorded.">
        <StatusLabel value={result.status} />
        {result.status === "ready" && result.manifest ? <><p>{result.manifest.rowCount} rows across {result.manifest.scopes.length} scopes. Integrity digest: <code>{result.digest}</code></p><a className="ry-button ry-button-primary" href={`/api/data-exports/${result.id}/download`}>Download export</a></> : <p>The durable worker will generate this package. It is safe to leave this page; failures remain retryable in Operations.</p>}
      </ReviewSection> : null}
      <ReviewSection eyebrow="History" title="Export history" description="Exports requested during this session remain visible for status review.">
        {history.length ? <Table caption="Export history"><thead><tr><th>Export</th><th>Status</th><th>Digest</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{item.id}</td><td><StatusLabel value={item.status} /></td><td><code>{item.digest}</code></td></tr>)}</tbody></Table> : <EmptyState compact description="No exports have been requested in this session." />}
      </ReviewSection>
      <ConfirmationDialog open={confirmOpen} title="Confirm audited export" description={`Generate a ${format === "json" ? "Portable JSON" : "CSV bundle"} export for ${selected.length} selected scope(s).`} consequence={<p>The package is workspace-scoped, audit recorded, and generated asynchronously. Document inclusion remains subject to policy review.</p>} confirmLabel="Generate audited export" processing={working} onConfirm={() => void createExport()} onClose={() => setConfirmOpen(false)} />
    </div>
  );
}
