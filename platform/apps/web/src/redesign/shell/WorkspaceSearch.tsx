import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { appPath } from "../../appBase";
import { ShellIcon } from "./ShellIcon";

type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  rank: number;
};

type SearchResponse = {
  results: SearchResult[];
};

const SUGGESTION_LIMIT = 8;
const DEBOUNCE_MS = 200;

function resultPath(result: SearchResult): string {
  const routes: Record<string, string> = {
    brand: appPath("/brands"),
    product: appPath("/products"),
    business: appPath("/buyers"),
    placement_opportunity: appPath("/placements"),
    account: appPath("/accounts"),
    order: appPath("/orders"),
    commission: appPath("/commissions"),
    task: appPath("/tasks")
  };
  const root = routes[result.type];
  if (root === appPath("/tasks")) return appPath("/tasks");
  if (root) return `${root}/${result.id}`;
  if (["contact", "note", "document"].includes(result.type)) {
    return appPath(`/records/${result.type}/${result.id}`);
  }
  return appPath(`/records/${result.type}/${result.id}`);
}

function typeLabel(type: string): string {
  return type.replaceAll("_", " ");
}

export function WorkspaceSearch() {
  const navigate = useNavigate();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestId = useRef(0);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 1) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    const currentRequest = ++requestId.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void api<SearchResponse>(
        `/api/search?q=${encodeURIComponent(value)}&limit=${SUGGESTION_LIMIT}`
      )
        .then((response) => {
          if (currentRequest !== requestId.current) return;
          setResults(response.results);
          setOpen(true);
          setActiveIndex(response.results.length ? 0 : -1);
        })
        .catch(() => {
          if (currentRequest !== requestId.current) return;
          setResults([]);
          setOpen(true);
          setActiveIndex(-1);
        })
        .finally(() => {
          if (currentRequest === requestId.current) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function closeSuggestions() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function openResult(result: SearchResult) {
    closeSuggestions();
    setQuery("");
    setResults([]);
    void navigate(resultPath(result));
    inputRef.current?.blur();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (open) {
        closeSuggestions();
        return;
      }
      setQuery("");
      return;
    }

    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
      setOpen(true);
    }

    if (event.key === "ArrowDown") {
      if (!results.length) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp") {
      if (!results.length) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
      return;
    }

    if (event.key === "Enter") {
      const selected = activeIndex >= 0 ? results[activeIndex] : results[0];
      if (!selected) return;
      event.preventDefault();
      openResult(selected);
    }
  }

  const showPanel = open && query.trim().length > 0;
  const activeId = activeIndex >= 0 && results[activeIndex]
    ? `${listId}-option-${activeIndex}`
    : undefined;

  return (
    <div
      className={`ry-workspace-search${showPanel ? " ry-workspace-search-open" : ""}`}
      ref={containerRef}
    >
      <ShellIcon name="search" />
      <input
        ref={inputRef}
        className="ry-workspace-search-input"
        type="search"
        role="combobox"
        aria-label="Search workspace"
        aria-autocomplete="list"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-activedescendant={activeId}
        placeholder="Search brands, businesses, placements, tasks…"
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => {
          if (query.trim() && (results.length || !loading)) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {showPanel ? (
        <ul
          id={listId}
          className="ry-workspace-search-results"
          role="listbox"
          aria-label="Search suggestions"
        >
          {loading && !results.length ? (
            <li className="ry-workspace-search-status" role="presentation">Searching…</li>
          ) : null}
          {results.map((result, index) => (
            <li
              key={`${result.type}-${result.id}`}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "is-active" : undefined}
            >
              <button
                type="button"
                className="ry-workspace-search-result"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => openResult(result)}
              >
                <span className="ry-workspace-search-result-title">{result.title}</span>
                <span className="ry-workspace-search-result-meta">
                  {typeLabel(result.type)}
                  {result.subtitle ? ` · ${result.subtitle}` : ""}
                </span>
              </button>
            </li>
          ))}
          {!loading && results.length === 0 ? (
            <li className="ry-workspace-search-status" role="presentation">No matches</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
