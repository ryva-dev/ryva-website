import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { ErrorPanel, Loading, PageHeader, StatusPill } from "../components";

type Task = { id: string; subjectType: string; subjectId: string; title: string; status: string; priority: string; dueAt: string | null; mandatoryGate: boolean; version: number };

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    try { setTasks((await api<{tasks: Task[]}>("/api/tasks")).tasks); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Tasks could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function complete(task: Task) {
    try {
      await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: {
          version: task.version,
          status: "completed",
          completionEvidence: task.mandatoryGate ? "Verified manually by task owner." : null
        }
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Task could not be updated.");
    }
  }
  return (
    <div className="page">
      <PageHeader eyebrow="Owned work" title="Tasks" description="Actionable work linked to its originating record. Mandatory gates require completion evidence." />
      {loading ? <Loading /> : null}{error ? <ErrorPanel message={error} /> : null}
      <section className="panel">
        <div className="record-list">
          {tasks.map((task) => (
            <div className="task-row" key={task.id}>
              <Link to={`/records/${task.subjectType}/${task.subjectId}`}><span><strong>{task.title}</strong><small>{task.priority} priority{task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString()}` : ""}</small></span></Link>
              <StatusPill value={task.status} />
              {task.status !== "completed" ? <button className="secondary-button" onClick={() => void complete(task)}>Complete</button> : null}
            </div>
          ))}
        </div>
        {tasks.length === 0 ? <p className="empty-state">No tasks are assigned to you.</p> : null}
      </section>
    </div>
  );
}
