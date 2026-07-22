import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Select,
  Table,
  DataRow,
  Input
} from "../../design-system";

type SearchResult = { id: string; type: string; title: string; subtitle: string; rank: number };
type SearchResponse = {
  results: SearchResult[];
  page: { limit: number; offset: number; hasMore: boolean; nextOffset: number | null };
};

function resultPath(result: SearchResult): string {
  if (["brand", "product", "business", "contact"].includes(result.type)) {
    return `/records/${result.type}/${result.id}`;
  }
  if (result.type === "account") return `/accounts/${result.id}`;
  if (result.type === "order") return `/orders/${result.id}`;
  if (result.type === "commission") return `/commissions/${result.id}`;
  if (result.type === "placement_opportunity") return `/placements/${result.id}`;
  return "#";
}

const recordTypes = ["brand", "product", "business", "contact", "placement_opportunity", "account", "order", "commission", "document", "note"];

export function SearchWorkspacePage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [page, setPage] = useState<SearchResponse["page"] | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runSearch(offset = 0) {
    setLoading(true);
    setError("");
    try {
      const response = await api<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}&offset=${offset}${type ? `&type=${encodeURIComponent(type)}` : ""}`);
      setResults(response.results);
      setPage(response.page);
      setSearched(true);
    } catch {
      setError("Search could not be completed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function search(event: FormEvent) {
    event.preventDefault();
    void runSearch();
  }

  return (
    <div className="page ry-search-page">
      <PageHeader
        eyebrow="Workspace search"
        title="Find connected context"
        description="Authorized results are filtered by workspace before PostgreSQL ranks them."
      />
      <section className="panel ry-search-panel" aria-label="Search results">
        <form className="ry-search-form" onSubmit={search}>
          <Field label="Search workspace">
            <Input autoFocus required value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search workspace" type="search" />
          </Field>
          <Field label="Filter by record type">
            <Select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by record type">
              <option value="">All record types</option>
              {recordTypes.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
            </Select>
          </Field>
          <Button type="submit" loading={loading}>Search</Button>
        </form>
        {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void runSearch(page?.offset ?? 0)}>Try again</Button>} /> : null}
        {loading && !searched ? <LoadingState label="Searching authorized records" /> : null}
        {results.length ? <Table caption="Authorized search results">
          <thead><tr><th scope="col">Record</th><th scope="col">Type</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
          <tbody>{results.map((result) => <DataRow key={`${result.type}-${result.id}`}>
            <td><strong>{result.title}</strong><small className="ry-search-subtitle">{result.subtitle}</small></td>
            <td>{result.type.replaceAll("_", " ")}</td>
            <td><Link to={resultPath(result)}>Open</Link></td>
          </DataRow>)}</tbody>
        </Table> : null}
        {searched && !loading && results.length === 0 ? <EmptyState description="No authorized records match this search." /> : null}
        {page ? <nav className="ry-search-pagination" aria-label="Search results pagination">
          <Button variant="tertiary" disabled={loading || page.offset === 0} onClick={() => void runSearch(Math.max(0, page.offset - page.limit))}>Previous</Button>
          <span>Results {page.offset + 1}–{page.offset + results.length}</span>
          <Button variant="tertiary" disabled={loading || !page.hasMore} onClick={() => void runSearch(page.nextOffset ?? page.offset)}>Next</Button>
        </nav> : null}
      </section>
    </div>
  );
}
