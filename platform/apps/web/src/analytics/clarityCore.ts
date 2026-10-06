import { PUBLIC_SEO_ROUTES } from "../seo/routes.js";

const SCRIPT_ID = "ryva-clarity-script";
const PROJECT_ID_PATTERN = /^[a-z0-9]{6,32}$/;

type ClarityCommand = ArrayLike<unknown>;
type ClarityFunction = ((...args: unknown[]) => void) & { q?: ClarityCommand[] };

export type ClarityRuntime = {
  clarity?: ClarityFunction;
  __ryvaClarityProjectId?: string;
};

export type ClarityEnvironment = {
  runtime: ClarityRuntime;
  hasScript(id: string): boolean;
  appendScript(input: { id: string; src: string }): void;
};

export function normalizeClarityProjectId(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && PROJECT_ID_PATTERN.test(normalized) ? normalized : null;
}

export function initializeMicrosoftClarity(
  projectId: string | null,
  pathname: string,
  environment: ClarityEnvironment
): boolean {
  if (!projectId || !PUBLIC_SEO_ROUTES[pathname]) return false;

  const { runtime } = environment;
  if (runtime.__ryvaClarityProjectId === projectId) return true;

  runtime.clarity ??= function () {
    runtime.clarity!.q ??= [];
    // Clarity's documented loader queues the standard Arguments object.
    // eslint-disable-next-line prefer-rest-params
    runtime.clarity!.q.push(arguments);
  };

  if (!environment.hasScript(SCRIPT_ID)) {
    environment.appendScript({
      id: SCRIPT_ID,
      src: `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`
    });
  }

  runtime.__ryvaClarityProjectId = projectId;
  return true;
}
