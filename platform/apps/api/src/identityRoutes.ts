import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express, RequestHandler, Response } from "express";
import QRCode from "qrcode";
import { z } from "zod";
import type { AppConfig } from "../../../packages/config/src/index.js";
import type { Database } from "../../../packages/database/src/index.js";
import {
  confirmStaffMfaEnrollment,
  getStaffMfaEnrollment,
  randomToken,
  registerCustomer,
  requestPasswordReset,
  resetPassword
} from "../../../packages/domain/src/index.js";
import { AppError, emailSchema } from "../../../packages/shared/src/index.js";
import { asyncRoute } from "./middleware.js";
import "./types.js";

const publicCsrfCookie = "ryva_public_csrf";
export const staffMfaSetupCookie = "ryva_mfa_setup";
const legalEffectiveDate = "2026-10-02";

type RouteDependencies = {
  app: Express;
  database: Database;
  configuration: AppConfig;
  rateLimit(this: void, input: { prefix: string; limit: number; windowSeconds: number }): RequestHandler;
};

function signedPublicCsrf(configuration: AppConfig): string {
  const token = randomToken();
  const signature = createHmac("sha256", configuration.SESSION_PEPPER).update(token).digest("base64url");
  return `${token}.${signature}`;
}

function validPublicCsrf(configuration: AppConfig, value: string): boolean {
  const separator = value.lastIndexOf(".");
  if (separator < 1) return false;
  const token = value.slice(0, separator);
  const provided = Buffer.from(value.slice(separator + 1));
  const expected = Buffer.from(
    createHmac("sha256", configuration.SESSION_PEPPER).update(token).digest("base64url")
  );
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function setPublicCsrf(response: Response, configuration: AppConfig): void {
  response.cookie(publicCsrfCookie, signedPublicCsrf(configuration), {
    httpOnly: false,
    secure: configuration.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 1000
  });
}

function requirePublicCsrf(configuration: AppConfig): RequestHandler {
  return (request, _response, next) => {
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const cookie = cookies?.[publicCsrfCookie];
    const header = request.header("x-csrf-token");
    if (!cookie || !header || cookie !== header || !validPublicCsrf(configuration, cookie)) {
      return next(new AppError(403, "csrf_invalid", "The security token is missing or invalid."));
    }
    return next();
  };
}

function legalDocuments(configuration: AppConfig) {
  return {
    terms: {
      url: configuration.TERMS_DOCUMENT_URL || new URL("/terms", configuration.APP_URL).toString(),
      version: configuration.TERMS_DOCUMENT_VERSION || legalEffectiveDate
    },
    privacy: {
      url: configuration.PRIVACY_DOCUMENT_URL || new URL("/privacy", configuration.APP_URL).toString(),
      version: configuration.PRIVACY_DOCUMENT_VERSION || legalEffectiveDate
    },
    refundPolicy: {
      url: configuration.REFUND_POLICY_DOCUMENT_URL || new URL("/refund-policy", configuration.APP_URL).toString(),
      version: configuration.REFUND_POLICY_DOCUMENT_VERSION || legalEffectiveDate
    },
    disclaimer: {
      url: configuration.DISCLAIMER_DOCUMENT_URL || new URL("/disclaimer", configuration.APP_URL).toString(),
      version: configuration.DISCLAIMER_DOCUMENT_VERSION || legalEffectiveDate
    }
  };
}

const registrationSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: emailSchema,
  password: z.string().min(14).max(256),
  passwordConfirmation: z.string().min(1).max(256),
  termsAccepted: z.literal(true),
  privacyAcknowledged: z.literal(true),
  termsVersion: z.string().trim().min(1).max(120),
  privacyVersion: z.string().trim().min(1).max(120)
}).superRefine((value, context) => {
  if (value.password !== value.passwordConfirmation) {
    context.addIssue({
      code: "custom",
      path: ["passwordConfirmation"],
      message: "Passwords must match."
    });
  }
});

export function registerIdentityRoutes({
  app,
  database,
  configuration,
  rateLimit
}: RouteDependencies): void {
  const publicCsrf = requirePublicCsrf(configuration);

  app.get("/api/identity/csrf", (_request, response) => {
    setPublicCsrf(response, configuration);
    response.status(204).end();
  });

  app.get("/api/identity/context", (request, response) => {
    void request;
    setPublicCsrf(response, configuration);
    response.json({ legalDocuments: legalDocuments(configuration) });
  });

  app.post(
    "/api/identity/register",
    publicCsrf,
    rateLimit({
      prefix: "account_registration",
      limit: 5,
      windowSeconds: configuration.RATE_LIMIT_WINDOW_SECONDS
    }),
    asyncRoute(async (request, response) => {
      const input = registrationSchema.parse(request.body);
      const documents = legalDocuments(configuration);
      if (
        input.termsVersion !== documents.terms.version ||
        input.privacyVersion !== documents.privacy.version
      ) {
        throw new AppError(409, "legal_documents_changed", "The legal documents changed. Review them again.");
      }
      await registerCustomer(database, configuration, {
        ...input,
        ...(request.ip ? { ipAddress: request.ip } : {}),
        ...(request.get("user-agent") ? { userAgent: request.get("user-agent")! } : {})
      }, request.requestId);
      response.status(201).json({ created: true });
    })
  );

  app.post(
    "/api/identity/password-reset/request",
    publicCsrf,
    rateLimit({
      prefix: "password_reset_request",
      limit: 5,
      windowSeconds: configuration.RATE_LIMIT_WINDOW_SECONDS
    }),
    asyncRoute(async (request, response) => {
      const input = z.object({ email: emailSchema }).parse(request.body);
      await requestPasswordReset(database, configuration, input.email, request.requestId);
      response.status(202).json({
        accepted: true,
        message: "If an eligible account exists, password-reset instructions will be sent."
      });
    })
  );

  app.post(
    "/api/identity/password-reset/confirm",
    publicCsrf,
    rateLimit({
      prefix: "password_reset_confirm",
      limit: 10,
      windowSeconds: configuration.RATE_LIMIT_WINDOW_SECONDS
    }),
    asyncRoute(async (request, response) => {
      const input = z.object({
        token: z.string().min(32).max(500),
        password: z.string().min(14).max(256),
        passwordConfirmation: z.string().min(1).max(256)
      }).superRefine((value, context) => {
        if (value.password !== value.passwordConfirmation) {
          context.addIssue({ code: "custom", path: ["passwordConfirmation"], message: "Passwords must match." });
        }
      }).parse(request.body);
      await resetPassword(database, configuration, input.token, input.password, request.requestId);
      response.status(204).end();
    })
  );

  app.get(
    "/api/auth/mfa/enrollment",
    asyncRoute(async (request, response) => {
      const token = request.cookies?.[staffMfaSetupCookie] as string | undefined;
      if (!token) throw new AppError(401, "mfa_setup_required", "Sign in to begin multi-factor setup.");
      const enrollment = await getStaffMfaEnrollment(database, configuration, token);
      const label = encodeURIComponent(`Ryva:${enrollment.email}`);
      const otpauth = `otpauth://totp/${label}?secret=${encodeURIComponent(enrollment.secret)}&issuer=Ryva&algorithm=SHA1&digits=6&period=30`;
      const qrCodeDataUrl = await QRCode.toDataURL(otpauth, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 240
      });
      setPublicCsrf(response, configuration);
      response.json({ qrCodeDataUrl, expiresAt: enrollment.expiresAt });
    })
  );

  app.post(
    "/api/auth/mfa/enrollment/confirm",
    publicCsrf,
    rateLimit({
      prefix: "mfa_enrollment_confirm",
      limit: 10,
      windowSeconds: configuration.RATE_LIMIT_WINDOW_SECONDS
    }),
    asyncRoute(async (request, response) => {
      const token = request.cookies?.[staffMfaSetupCookie] as string | undefined;
      if (!token) throw new AppError(401, "mfa_setup_required", "Sign in to begin multi-factor setup.");
      const input = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(request.body);
      await confirmStaffMfaEnrollment(database, configuration, token, input.code, request.requestId);
      response.clearCookie(staffMfaSetupCookie, {
        httpOnly: true,
        secure: configuration.NODE_ENV === "production",
        sameSite: "strict",
        path: "/"
      });
      response.status(204).end();
    })
  );
}
