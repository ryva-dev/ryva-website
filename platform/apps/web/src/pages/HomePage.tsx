import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import {
  CommandCenter,
  type CommandCenterData,
  type CommandCenterPriority
} from "../redesign/home/CommandCenter";

type AiStatus = {
  enabled: boolean;
  provider: { configured: boolean };
  workspacePreferences: { enabled: boolean };
};

type SuggestionDetail = {
  suggestion: { id: string };
};

function readable(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function HomePage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [briefingError, setBriefingError] = useState("");
  const [creatingBriefing, setCreatingBriefing] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [home, status] = await Promise.all([
        api<CommandCenterData>("/api/home-command-center"),
        api<AiStatus>("/api/ai/status").catch(() => null)
      ]);
      setData(home);
      setAiStatus(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Home priorities could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const briefingAvailable = useMemo(() => Boolean(
    aiStatus?.enabled &&
    aiStatus.provider.configured &&
    aiStatus.workspacePreferences.enabled === true
  ), [aiStatus]);

  if (!session) return null;

  const workspaceId = session.user.workspaceId;

  async function priorityAction(
    item: CommandCenterPriority,
    action: "completed" | "snoozed" | "dismissed" | "reprioritized",
    manualPriority?: string
  ) {
    setSaving(item.key);
    setError("");
    try {
      const body: Record<string, unknown> = {
        action,
        reason: action === "reprioritized" ? "Representative changed priority." : `${readable(action)} from Home.`
      };
      if (action === "snoozed") body.snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      if (manualPriority) body.manualPriority = manualPriority;
      setData(await api<CommandCenterData>(`/api/home/priorities/${item.itemType}/${item.itemId}/actions`, { method: "POST", body }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Priority action could not be recorded.");
    } finally {
      setSaving("");
    }
  }

  async function acknowledge() {
    setError("");
    try {
      await api("/api/home/acknowledge", { method: "POST" });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Changes could not be acknowledged.");
    }
  }

  async function generateBriefing(useCase: "daily_briefing" | "weekly_briefing") {
    setCreatingBriefing(useCase);
    setBriefingError("");
    try {
      const result = await api<SuggestionDetail>("/api/ai/generate", {
        method: "POST",
        body: {
          useCase,
          targetType: "workspace",
          targetId: workspaceId,
          instruction: "Prioritize trust, authority, commitments, Buyer value, and missing evidence. Do not rank by commission."
        }
      });
      void navigate(`/copilot/${result.suggestion.id}`);
    } catch (caught) {
      setBriefingError(caught instanceof Error ? caught.message : "Briefing could not be generated.");
    } finally {
      setCreatingBriefing("");
    }
  }

  return (
    <CommandCenter
      session={session}
      data={data}
      loading={loading}
      error={error}
      saving={saving}
      briefing={{
        available: briefingAvailable,
        error: briefingError,
        creating: creatingBriefing
      }}
      onReload={() => void load()}
      onAcknowledge={() => void acknowledge()}
      onPriorityAction={(item, action, manualPriority) => void priorityAction(item, action, manualPriority)}
      onBriefingGenerate={(useCase) => void generateBriefing(useCase)}
    />
  );
}
