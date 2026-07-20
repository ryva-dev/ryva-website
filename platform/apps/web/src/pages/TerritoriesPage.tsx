import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import { ErrorPanel, Field, PageHeader, StatusPill } from "../components";

type Territory = { id: string; name: string; territoryType: string; scope: Record<string,unknown>; status: string };

export function TerritoriesPage() {
  const [items, setItems] = useState<Territory[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("geography");
  const [scope, setScope] = useState("");
  const [error, setError] = useState("");
  async function load() {
    try { setItems((await api<{territories: Territory[]}>("/api/territories")).territories); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Territories could not be loaded."); }
  }
  useEffect(() => { void load(); }, []);
  async function create(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      await api("/api/territories", {
        method: "POST",
        body: { name, territoryType: type, scope: { description: scope }, status: "proposed" }
      });
      setName(""); setScope(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Territory could not be saved."); }
  }
  return (
    <div className="page">
      <PageHeader eyebrow="Commercial scope" title="Territories" description="Explicit geography, channel, or account-list boundaries. Proposed scope does not create representation authority." />
      {error ? <ErrorPanel message={error} /> : null}
      <div className="split-grid">
        <section className="panel"><h2>Territory register</h2><ul className="plain-list">{items.map((item) => <li key={item.id}><span><strong>{item.name}</strong><small>{item.territoryType} · {typeof item.scope.description === "string" ? item.scope.description : "No description"}</small></span><StatusPill value={item.status} /></li>)}</ul>{items.length === 0 ? <p className="empty-state">No territories are defined.</p> : null}</section>
        <section className="panel"><h2>Propose territory</h2><form onSubmit={(event) => void create(event)}><Field label="Name"><input required value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Type"><select value={type} onChange={(event) => setType(event.target.value)}><option value="geography">Geography</option><option value="channel">Channel</option><option value="account_list">Account list</option><option value="hybrid">Hybrid</option></select></Field><Field label="Scope description"><textarea required value={scope} onChange={(event) => setScope(event.target.value)} /></Field><button className="primary-button">Save proposal</button></form></section>
      </div>
    </div>
  );
}
