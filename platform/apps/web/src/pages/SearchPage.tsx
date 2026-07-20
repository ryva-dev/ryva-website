import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { ErrorPanel, PageHeader } from "../components";

type SearchResult = { id: string; type: string; title: string; subtitle: string; rank: number };
type SearchResponse={results:SearchResult[];page:{limit:number;offset:number;hasMore:boolean;nextOffset:number|null}};

function resultPath(result: SearchResult): string {
  if (["brand","product","business","contact"].includes(result.type)) {
    return `/records/${result.type}/${result.id}`;
  }
  if (result.type === "account") return `/accounts/${result.id}`;
  if (result.type === "order") return `/orders/${result.id}`;
  if (result.type === "commission") return `/commissions/${result.id}`;
  if (result.type === "placement_opportunity") return `/placements/${result.id}`;
  return "#";
}

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [type,setType]=useState("");
  const [page,setPage]=useState<SearchResponse["page"]|null>(null);
  async function runSearch(offset=0) {
    const response=await api<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}&offset=${offset}${type?`&type=${encodeURIComponent(type)}`:""}`);
    setResults(response.results);setPage(response.page);setSearched(true);
  }
  async function search(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await runSearch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed.");
    }
  }
  return (
    <div className="page">
      <PageHeader eyebrow="Workspace search" title="Find connected context" description="Authorized results are filtered by workspace before PostgreSQL ranks them." />
      <section className="panel">
        <form className="inline-search" onSubmit={(event) => void search(event)}>
          <input autoFocus required value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search workspace" />
          <select value={type} onChange={event=>setType(event.target.value)} aria-label="Filter by record type">
            <option value="">All record types</option>
            {["brand","product","business","contact","placement_opportunity","account","order","commission","document","note"].map(item=>
              <option key={item} value={item}>{item.replaceAll("_"," ")}</option>)}
          </select>
          <button className="primary-button">Search</button>
        </form>
        {error ? <ErrorPanel message={error} /> : null}
        <div className="record-list">
          {results.map((result) => (
            <Link key={`${result.type}-${result.id}`} to={resultPath(result)}>
              <span><strong>{result.title}</strong><small>{result.type} · {result.subtitle}</small></span>
            </Link>
          ))}
        </div>
        {searched && results.length === 0 ? <p className="empty-state">No authorized records match this search.</p> : null}
        {page?<div className="button-row">
          <button className="text-button" disabled={page.offset===0} onClick={()=>void runSearch(Math.max(0,page.offset-page.limit))}>Previous</button>
          <span>Results {page.offset+1}–{page.offset+results.length}</span>
          <button className="text-button" disabled={!page.hasMore} onClick={()=>void runSearch(page.nextOffset??page.offset)}>Next</button>
        </div>:null}
      </section>
    </div>
  );
}
