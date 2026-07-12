import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleCodeForTokens,
  getGmailConnectRedirectUri,
  getGoogleLoginRedirectUri
} from "./googleOAuth.mjs";

test("Gmail authorize and token exchange use the same redirect URI", async () => {
  const redirectUri = getGmailConnectRedirectUri("https://app.ryva.test", "mara-vale");
  assert.equal(redirectUri, "https://app.ryva.test/api/office/workers/mara-vale/gmail/callback");
  assert.notEqual(redirectUri, getGoogleLoginRedirectUri("https://app.ryva.test"));

  const authUrl = buildGoogleAuthorizationUrl({
    clientId: "client-id",
    redirectUri,
    scope: "openid email",
    state: "nonce",
    accessType: "offline",
    prompt: "consent"
  });
  assert.equal(authUrl.searchParams.get("redirect_uri"), redirectUri);

  let exchangedRedirect = null;
  const fetchImpl = async (_url, options) => {
    const body = new URLSearchParams(options.body);
    exchangedRedirect = body.get("redirect_uri");
    return {
      ok: true,
      async json() {
        return { access_token: "a", refresh_token: "r", expires_in: 3600 };
      }
    };
  };
  process.env.GOOGLE_CLIENT_ID = "client-id";
  process.env.GOOGLE_CLIENT_SECRET = "secret";
  await exchangeGoogleCodeForTokens("auth-code", redirectUri, fetchImpl);
  assert.equal(exchangedRedirect, redirectUri);
});

test("token exchange without redirect URI fails closed", async () => {
  process.env.GOOGLE_CLIENT_ID = "client-id";
  process.env.GOOGLE_CLIENT_SECRET = "secret";
  await assert.rejects(() => exchangeGoogleCodeForTokens("code", ""), /redirect_uri/);
});
