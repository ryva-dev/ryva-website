import type { AccessDecision, SessionIdentity } from "../../../packages/domain/src/index.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      identity?: SessionIdentity;
      access?: AccessDecision;
    }
  }
}

export {};
