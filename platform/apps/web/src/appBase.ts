/** Base path for the authenticated Ryva platform (marketing owns `/`). */
export const APP_BASE = "/app";

/** Prefix a platform path with `/app`. Pass `"/"` or `""` for the app home. */
export function appPath(path = "/"): string {
  if (!path || path === "/") return APP_BASE;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE}${normalized}`;
}

/** Strip `/app` prefix for label matching; returns pathname unchanged if not under app. */
export function stripAppBase(pathname: string): string {
  if (pathname === APP_BASE || pathname === `${APP_BASE}/`) return "/";
  if (pathname.startsWith(`${APP_BASE}/`)) return pathname.slice(APP_BASE.length) || "/";
  return pathname;
}
