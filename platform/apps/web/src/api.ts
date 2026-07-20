export type AccessDecision = {
  mode:
    | "full"
    | "read_only"
    | "certification_required"
    | "subscription_required"
    | "restricted"
    | "blocked";
  reason: string;
  credentialStatus: string | null;
  subscriptionStatus: string | null;
  graceEndsAt: string | null;
  capabilities: string[];
};

export type Session = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    workspaceId: string;
  };
  access: AccessDecision;
};

export class ApiProblem extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly type: string,
    readonly errors?: Record<string, string[]>
  ) {
    super(message);
  }
}

function textValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function cookie(name: string): string | undefined {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length);
}

export async function api<T>(
  path: string,
  options: Omit<RequestInit, "body"> & { body?: BodyInit | Record<string, unknown> } = {}
): Promise<T> {
  const { body: requestedBody, ...requestBase } = options;
  const headers = new Headers(requestBase.headers);
  let body = requestedBody;
  if (
    body &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof Blob)
  ) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(body);
  }
  const method = options.method?.toUpperCase() ?? "GET";
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = cookie("ryva_csrf");
    if (csrf) headers.set("x-csrf-token", decodeURIComponent(csrf));
  }
  const requestOptions: RequestInit = {
    ...requestBase,
    headers,
    ...(body === undefined ? {} : { body: body as BodyInit })
  };
  const response = await fetch(path, requestOptions);
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiProblem(
      textValue(payload.detail ?? payload.title, "The request could not be completed."),
      response.status,
      textValue(payload.type, "unknown"),
      payload.errors as Record<string, string[]> | undefined
    );
  }
  return payload as T;
}
