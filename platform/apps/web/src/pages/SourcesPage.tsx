import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import { ErrorPanel, Field, PageHeader, StatusPill } from "../components";

type Source = {
  id: string; sourceType: string; reference: string; url: string | null;
  ownerOrProvider: string; rightsClassification: string; confidentiality: string; status: string;
};

export function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [reference, setReference] = useState("");
  const [owner, setOwner] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  async function load() {
    try { setSources((await api<{sources: Source[]}>("/api/sources")).sources); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Sources could not be loaded."); }
  }
  useEffect(() => { void load(); }, []);
  async function create(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      await api("/api/sources", {
        method: "POST",
        body: {
          sourceType: "user_supplied",
          reference,
          url: url || null,
          ownerOrProvider: owner,
          rightsClassification: "unknown",
          confidentiality: "normal"
        }
      });
      setReference(""); setOwner(""); setUrl(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Source could not be saved."); }
  }
  return (
    <div className="page">
      <PageHeader eyebrow="Evidence provenance" title="Sources" description="Record where evidence came from, who controls it, and how Ryva may use it before drawing conclusions." />
      {error ? <ErrorPanel message={error} /> : null}
      <div className="split-grid">
        <section className="panel">
          <h2>Source register</h2>
          <ul className="plain-list">{sources.map((source) => <li key={source.id}><span><strong>{source.reference}</strong><small>{source.sourceType} · {source.ownerOrProvider} · {source.rightsClassification}</small></span><StatusPill value={source.status} /></li>)}</ul>
          {sources.length === 0 ? <p className="empty-state">No evidence sources are registered.</p> : null}
        </section>
        <section className="panel">
          <h2>Register source</h2>
          <form onSubmit={(event) => void create(event)}>
            <Field label="Reference"><input required value={reference} onChange={(event) => setReference(event.target.value)} /></Field>
            <Field label="Owner or provider"><input required value={owner} onChange={(event) => setOwner(event.target.value)} /></Field>
            <Field label="URL"><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} /></Field>
            <button className="primary-button">Register source</button>
          </form>
        </section>
      </div>
    </div>
  );
}
