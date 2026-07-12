/**
 * Google OAuth helpers for login and Gmail connect.
 * Authorization and token exchange MUST use the same redirect_uri.
 */
import { incrementMetric } from "./metrics.mjs";

export function getAppUrl() {
  return String(process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
}

export function getGoogleLoginRedirectUri(appUrl = getAppUrl()) {
  return `${appUrl}/api/auth/google/callback`;
}

/** Canonical Gmail connect callback — used for BOTH authorize and token exchange. */
export function getGmailConnectRedirectUri(appUrl = getAppUrl(), workerSlug = "mara-vale") {
  const slug = String(workerSlug || "mara-vale").trim() || "mara-vale";
  return `${appUrl}/api/office/workers/${slug}/gmail/callback`;
}

export function assertGoogleOAuthConfigured() {
  const clientId = String(process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) {
    const error = new Error("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
    error.code = "GOOGLE_OAUTH_NOT_CONFIGURED";
    throw error;
  }
  return { clientId, clientSecret };
}

export function buildGoogleAuthorizationUrl({
  accessType = null,
  prompt = "select_account",
  redirectUri,
  scope,
  state,
  clientId = String(process.env.GOOGLE_CLIENT_ID ?? "").trim()
}) {
  if (!clientId) {
    const error = new Error("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
    error.code = "GOOGLE_OAUTH_NOT_CONFIGURED";
    throw error;
  }
  if (!redirectUri) {
    const error = new Error("OAuth redirect URI is required.");
    error.code = "GOOGLE_OAUTH_REDIRECT_MISSING";
    throw error;
  }
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", scope);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("prompt", prompt);
  if (accessType) authorizationUrl.searchParams.set("access_type", accessType);
  return authorizationUrl;
}

/**
 * Exchange an auth code for tokens.
 * @param {string} code
 * @param {string} redirectUri Must match the redirect_uri used in the authorization request.
 * @param {typeof fetch} [fetchImpl]
 */
export async function exchangeGoogleCodeForTokens(code, redirectUri, fetchImpl = globalThis.fetch) {
  const { clientId, clientSecret } = assertGoogleOAuthConfigured();
  if (!redirectUri) {
    const error = new Error("Token exchange requires the same redirect_uri used during authorization.");
    error.code = "GOOGLE_OAUTH_REDIRECT_MISSING";
    throw error;
  }
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });
  if (!response.ok) {
    incrementMetric("google_oauth_token_exchange_failed", 1);
    const error = new Error(
      `Google token exchange failed (${response.status}). Confirm the OAuth client includes redirect URI: ${redirectUri}`
    );
    error.code = "GOOGLE_OAUTH_TOKEN_EXCHANGE_FAILED";
    error.status = response.status;
    throw error;
  }
  incrementMetric("google_oauth_token_exchange_ok", 1);
  return response.json();
}

export async function refreshGoogleAccessToken(refreshToken, fetchImpl = globalThis.fetch) {
  const { clientId, clientSecret } = assertGoogleOAuthConfigured();
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });
  if (!response.ok) {
    incrementMetric("google_oauth_refresh_failed", 1);
    const error = new Error(`Google token refresh failed (${response.status}). Reconnect Gmail.`);
    error.code = "GOOGLE_OAUTH_REFRESH_FAILED";
    error.status = response.status;
    throw error;
  }
  incrementMetric("google_oauth_refresh_ok", 1);
  return response.json();
}

export const GMAIL_CONNECT_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose"
].join(" ");

export const GOOGLE_LOGIN_SCOPES = ["openid", "email", "profile"].join(" ");
