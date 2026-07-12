import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUserScopedTableCoverage,
  authorizeAccountDeletion,
  GLOBAL_TABLES_EXCLUDED_FROM_USER_DELETE,
  listUserIdTablesFromMigrations,
  USER_SCOPED_TABLES
} from "./accountErasure.mjs";

test("account erasure covers every migration user_id table or documents it as global", () => {
  assert.equal(assertUserScopedTableCoverage(), true);
  const fromMigrations = listUserIdTablesFromMigrations();
  assert.ok(fromMigrations.includes("mara_creative_patterns"));
  assert.ok(fromMigrations.includes("mara_brand_evidence"));
  assert.ok(USER_SCOPED_TABLES.includes("mara_creative_patterns"));
  assert.ok(GLOBAL_TABLES_EXCLUDED_FROM_USER_DELETE.includes("mara_public_brands"));
  assert.ok(GLOBAL_TABLES_EXCLUDED_FROM_USER_DELETE.includes("mara_global_trend_insights"));
});

test("authorizeAccountDeletion allows Google re-auth for password-less users", async () => {
  const googleOnly = {
    email: "creator@example.com",
    passwordHash: "salt:hash",
    passwordIsSet: 0
  };
  const denied = await authorizeAccountDeletion({
    user: googleOnly,
    password: "anything",
    verifyPassword: () => true,
    fetchGoogleProfile: async () => ({ email: "other@example.com", email_verified: true })
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "google_reauth_required");

  const allowed = await authorizeAccountDeletion({
    user: googleOnly,
    googleAccessToken: "ya29.test",
    verifyPassword: () => false,
    fetchGoogleProfile: async (token) => {
      assert.equal(token, "ya29.test");
      return { email: "creator@example.com", email_verified: true };
    }
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.method, "google");
});

test("authorizeAccountDeletion still requires correct password when password_is_set", async () => {
  const user = { email: "a@b.com", passwordHash: "x", passwordIsSet: 1 };
  const bad = await authorizeAccountDeletion({
    user,
    password: "nope",
    verifyPassword: () => false,
    fetchGoogleProfile: async () => ({ email: "a@b.com", email_verified: true })
  });
  // Google token also provided via second call path — when password fails, Google can still authorize.
  const viaGoogle = await authorizeAccountDeletion({
    user,
    password: "nope",
    googleAccessToken: "tok",
    verifyPassword: () => false,
    fetchGoogleProfile: async () => ({ email: "a@b.com", email_verified: true })
  });
  assert.equal(viaGoogle.ok, true);
  assert.equal(viaGoogle.method, "google");
  assert.equal(bad.ok, false);
});
