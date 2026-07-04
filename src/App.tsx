import { useEffect, useMemo, useState } from "react";
import { AboutPage } from "./components/AboutPage";
import { AuthModal } from "./components/AuthModal";
import { FilterSidebar } from "./components/FilterSidebar";
import { Navbar } from "./components/Navbar";
import { WorkerCard } from "./components/WorkerCard";
import { WorkerProfilePage } from "./components/WorkerProfilePage";
import type { Worker } from "./types";

type AuthUser = {
  createdAt: string;
  email: string;
  emailVerified: boolean;
  id: string;
  name: string;
};

const navItems = [
  { label: "Workers", href: "#workers" },
  { label: "About", href: "#about" }
];

const allowedViews = new Set(["workers", "about"]);

function getViewFromHash() {
  const hash = window.location.hash.replace("#", "");
  if (hash.startsWith("worker-")) {
    return hash;
  }
  return allowedViews.has(hash) ? hash : "workers";
}

function parseSalaryValue(salary: string) {
  return Number.parseInt(salary.replace(/[^0-9]/g, ""), 10);
}

function parseExperienceYears(experience: string) {
  return Number.parseInt(experience, 10);
}

function matchesDepartmentFilters(worker: Worker, selectedDepartments: string[]) {
  return selectedDepartments.length === 0 || selectedDepartments.includes(worker.department);
}

function matchesExperienceFilters(worker: Worker, selectedExperience: string[]) {
  if (selectedExperience.length === 0) {
    return true;
  }

  const years = parseExperienceYears(worker.experience);
  return selectedExperience.some((range) => {
    if (range === "0-2 years") return years <= 2;
    if (range === "3-5 years") return years >= 3 && years <= 5;
    if (range === "6-8 years") return years >= 6 && years <= 8;
    if (range === "9+ years") return years >= 9;
    return false;
  });
}

function matchesSalaryFilters(worker: Worker, selectedSalary: string[]) {
  if (selectedSalary.length === 0) {
    return true;
  }

  const salary = parseSalaryValue(worker.salary);
  return selectedSalary.some((range) => {
    if (range === "Under $4,000/mo") return salary < 4000;
    if (range === "$4,000 - $6,000") return salary >= 4000 && salary <= 6000;
    if (range === "$6,000 - $8,000") return salary > 6000 && salary <= 8000;
    if (range === "$8,000+") return salary >= 8000;
    return false;
  });
}

function matchesWorkerQuery(worker: Worker, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const searchableText = [
    worker.name,
    worker.title,
    worker.department,
    worker.experience,
    worker.description,
    worker.profile.category,
    worker.profile.industry,
    ...worker.skills,
    ...worker.profile.specialties
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedQuery);
}

function getWorkerRelevanceScore(worker: Worker, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 0;

  let score = 0;
  if (worker.name.toLowerCase().includes(normalizedQuery)) score += 10;
  if (worker.title.toLowerCase().includes(normalizedQuery)) score += 8;
  if (worker.department.toLowerCase().includes(normalizedQuery)) score += 6;
  if (worker.skills.some((skill) => skill.toLowerCase().includes(normalizedQuery))) score += 5;
  if (worker.profile.specialties.some((item) => item.toLowerCase().includes(normalizedQuery))) score += 4;
  if (worker.description.toLowerCase().includes(normalizedQuery)) score += 2;
  return score;
}

function sortWorkers(workers: Worker[], sort: string, query: string) {
  const sorted = [...workers];

  if (sort === "Relevance") {
    sorted.sort((a, b) => {
      const scoreDifference = getWorkerRelevanceScore(b, query) - getWorkerRelevanceScore(a, query);
      return scoreDifference !== 0 ? scoreDifference : a.name.localeCompare(b.name);
    });
    return sorted;
  }

  if (sort === "Salary: low to high") {
    sorted.sort((a, b) => parseSalaryValue(a.salary) - parseSalaryValue(b.salary));
    return sorted;
  }

  if (sort === "Salary: high to low") {
    sorted.sort((a, b) => parseSalaryValue(b.salary) - parseSalaryValue(a.salary));
    return sorted;
  }

  if (sort === "Experience: most first") {
    sorted.sort((a, b) => parseExperienceYears(b.experience) - parseExperienceYears(a.experience));
    return sorted;
  }

  return sorted;
}

async function apiJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Request failed.";
    throw new Error(message);
  }

  return payload as T;
}

function WorkersPage({
  onDepartmentToggle,
  onExperienceToggle,
  onHire,
  onSalaryToggle,
  onSortChange,
  selectedDepartments,
  selectedExperience,
  selectedSalary,
  selectedSort,
  totalWorkers,
  workers
}: {
  onDepartmentToggle: (value: string) => void;
  onExperienceToggle: (value: string) => void;
  onHire: (workerSlug: string) => void;
  onSalaryToggle: (value: string) => void;
  onSortChange: (value: string) => void;
  selectedDepartments: string[];
  selectedExperience: string[];
  selectedSalary: string[];
  selectedSort: string;
  totalWorkers: number;
  workers: Worker[];
}) {
  return (
    <main className="marketplace-page">
      <FilterSidebar
        onDepartmentToggle={onDepartmentToggle}
        onExperienceToggle={onExperienceToggle}
        onSalaryToggle={onSalaryToggle}
        onSortChange={onSortChange}
        selectedDepartments={selectedDepartments}
        selectedExperience={selectedExperience}
        selectedSalary={selectedSalary}
        selectedSort={selectedSort}
      />

      <section className="marketplace-results">
        <header className="results-header">
          <h1>Digital workers</h1>
          <p>
            {workers.length} of {totalWorkers} workers available
          </p>
        </header>

        {workers.length > 0 ? (
          <div className="worker-list">
            {workers.map((worker) => (
              <WorkerCard key={worker.slug} onHire={onHire} worker={worker} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>No workers found</h2>
            <p>Try a different role, skill, or department search.</p>
          </div>
        )}
      </section>
    </main>
  );
}

export default function App() {
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [globalNotice, setGlobalNotice] = useState("");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isWorkersLoading, setIsWorkersLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedExperience, setSelectedExperience] = useState<string[]>([]);
  const [selectedSalary, setSelectedSalary] = useState<string[]>([]);
  const [selectedSort, setSelectedSort] = useState("Relevance");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [view, setView] = useState(() => getViewFromHash());
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const activeWorker = view.startsWith("worker-")
    ? workers.find((worker) => `worker-${worker.slug}` === view)
    : undefined;

  const filteredWorkers = useMemo(
    () =>
      sortWorkers(
        workers.filter(
          (worker) =>
            matchesWorkerQuery(worker, searchQuery) &&
            matchesDepartmentFilters(worker, selectedDepartments) &&
            matchesExperienceFilters(worker, selectedExperience) &&
            matchesSalaryFilters(worker, selectedSalary)
        ),
        selectedSort,
        searchQuery
      ),
    [searchQuery, selectedDepartments, selectedExperience, selectedSalary, selectedSort, workers]
  );

  useEffect(() => {
    const onHashChange = () => setView(getViewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notice = params.get("notice");
    const resetTokenFromUrl = params.get("reset_token");

    if (notice === "email-verified") {
      setGlobalNotice("Email verified successfully.");
    }

    if (notice === "verification-invalid") {
      setGlobalNotice("Verification link is invalid or expired.");
    }

    if (resetTokenFromUrl) {
      setResetToken(resetTokenFromUrl);
      setIsAuthModalOpen(true);
      setGlobalNotice("Set a new password to complete your password reset.");
    }
  }, []);

  useEffect(() => {
    if (view.startsWith("worker-") && !activeWorker && workers.length > 0) {
      window.location.hash = "workers";
    }
  }, [activeWorker, view, workers.length]);

  useEffect(() => {
    async function loadWorkers() {
      try {
        const response = await apiJson<{ workers: Worker[] }>("/api/workers", { method: "GET" });
        setWorkers(response.workers);
      } finally {
        setIsWorkersLoading(false);
      }
    }

    async function loadSession() {
      try {
        const response = await apiJson<{ user: AuthUser | null }>("/api/auth/me", { method: "GET" });
        setUser(response.user);
      } catch {
        setUser(null);
      }
    }

    void loadWorkers();
    void loadSession();
  }, []);

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (view !== "workers") {
      window.location.hash = "workers";
    }
  }

  function toggleValue(values: string[], value: string, setter: (values: string[]) => void) {
    setter(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]);
  }

  async function handleLogin(input: { email: string; password: string }) {
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await apiJson<{ user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input)
      });
      setUser(response.user);
      setIsAuthModalOpen(false);
      setGlobalNotice(response.user.emailVerified ? "" : "Signed in. Your email is not verified yet.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRegister(input: { email: string; name: string; password: string }) {
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await apiJson<{
        emailVerificationPreview: string | null;
        emailVerificationSent: boolean;
        user: AuthUser;
      }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input)
      });
      setUser(response.user);
      setIsAuthModalOpen(false);
      setGlobalNotice(
        response.emailVerificationPreview
          ? `Account created. Verification email written to ${response.emailVerificationPreview}.`
          : "Account created. Check your email to verify your account."
      );
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await apiJson("/api/auth/logout", { method: "POST" });
    setUser(null);
    setGlobalNotice("Signed out.");
  }

  async function handlePasswordResetRequest(input: { email: string }) {
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await apiJson<{ ok: true; preview: string | null }>("/api/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify(input)
      });
      setIsAuthModalOpen(false);
      setGlobalNotice(
        response.preview
          ? `Password reset email written to ${response.preview}.`
          : "If that email exists, a password reset link has been sent."
      );
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to request password reset.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handlePasswordResetComplete(input: { password: string; token: string }) {
    setAuthLoading(true);
    setAuthError("");
    try {
      await apiJson<{ ok: true }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(input)
      });
      setResetToken(null);
      setIsAuthModalOpen(false);
      setGlobalNotice("Password updated successfully. You can now sign in.");
      const url = new URL(window.location.href);
      url.searchParams.delete("reset_token");
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to reset password.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleCheckout(workerSlug: string) {
    if (!user) {
      setAuthError("");
      setIsAuthModalOpen(true);
      return;
    }

    if (!user.emailVerified) {
      setGlobalNotice("Verify your email before checkout. If needed, sign in again after verifying.");
      return;
    }

    try {
      const response = await apiJson<{ url?: string }>("/api/payments/checkout", {
        method: "POST",
        body: JSON.stringify({ workerSlug })
      });

      if (response.url) {
        window.location.href = response.url;
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to start checkout.");
    }
  }

  return (
    <div className="app-frame">
      <div className="app-shell">
        <Navbar
          currentView={activeWorker ? "workers" : view}
          items={navItems}
          onAuthClick={() => {
            setAuthError("");
            setIsAuthModalOpen(true);
          }}
          onLogout={handleLogout}
          onSearchChange={handleSearchChange}
          searchQuery={searchQuery}
          userName={user?.name ?? null}
        />

        {globalNotice ? (
          <div className="notice-banner">
            <span>{globalNotice}</span>
            <button className="icon-button" onClick={() => setGlobalNotice("")} type="button" aria-label="Dismiss notice">
              ×
            </button>
          </div>
        ) : null}

        {isWorkersLoading ? (
          <div className="empty-state">
            <h2>Loading workers...</h2>
            <p>Fetching the worker marketplace.</p>
          </div>
        ) : null}

        {!isWorkersLoading && view === "workers" && (
          <WorkersPage
            onDepartmentToggle={(value) => toggleValue(selectedDepartments, value, setSelectedDepartments)}
            onExperienceToggle={(value) => toggleValue(selectedExperience, value, setSelectedExperience)}
            onHire={handleCheckout}
            onSalaryToggle={(value) => toggleValue(selectedSalary, value, setSelectedSalary)}
            onSortChange={setSelectedSort}
            selectedDepartments={selectedDepartments}
            selectedExperience={selectedExperience}
            selectedSalary={selectedSalary}
            selectedSort={selectedSort}
            totalWorkers={workers.length}
            workers={filteredWorkers}
          />
        )}

        {!isWorkersLoading && view === "about" && <AboutPage />}
        {!isWorkersLoading && activeWorker && <WorkerProfilePage onHire={handleCheckout} worker={activeWorker} />}
      </div>

      {isAuthModalOpen ? (
        <AuthModal
          error={authError}
          loading={authLoading}
          onClose={() => setIsAuthModalOpen(false)}
          onCompletePasswordReset={handlePasswordResetComplete}
          onLogin={handleLogin}
          onRequestPasswordReset={handlePasswordResetRequest}
          onRegister={handleRegister}
          resetToken={resetToken}
        />
      ) : null}
    </div>
  );
}
