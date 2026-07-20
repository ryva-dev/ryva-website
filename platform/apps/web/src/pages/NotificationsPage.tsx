import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ErrorPanel, Loading, PageHeader, StatusPill } from "../components";

type Notification = { id: string; title: string; reason: string; severity: string; status: string; blocking: boolean; dueAt: string | null };

export function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { setItems((await api<{notifications: Notification[]}>("/api/notifications")).notifications); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Notifications could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function markRead(id: string) {
    try { await api(`/api/notifications/${id}`, { method: "PATCH", body: { status: "read" } }); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Notification could not be updated."); }
  }
  return (
    <div className="page">
      <PageHeader eyebrow="Attention, not noise" title="Notifications" description="Critical and action-required items are ordered first, with the reason and related record preserved." />
      {loading ? <Loading /> : null}{error ? <ErrorPanel message={error} /> : null}
      <section className="panel">
        <ul className="plain-list">{items.map((item) => <li key={item.id}><span><strong>{item.title}</strong><small>{item.reason}{item.blocking ? " · blocking" : ""}</small></span><StatusPill value={item.severity} />{item.status === "unread" ? <button className="text-button" onClick={() => void markRead(item.id)}>Mark read</button> : null}</li>)}</ul>
        {items.length === 0 ? <p className="empty-state">No notifications need your attention.</p> : null}
      </section>
    </div>
  );
}
