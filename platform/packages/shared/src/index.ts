import { randomUUID } from "node:crypto";
import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().trim().toLowerCase().email().max(320);

export function newId(): string {
  return randomUUID();
}

export function now(): Date {
  return new Date();
}

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  requestId?: string;
  errors?: Record<string, string[]>;
};

export class AppError extends Error {
  readonly status: number;
  readonly type: string;
  readonly errors: Record<string, string[]> | undefined;

  constructor(
    status: number,
    type: string,
    title: string,
    options?: { errors?: Record<string, string[]> }
  ) {
    super(title);
    this.status = status;
    this.type = type;
    this.errors = options?.errors;
  }
}
