import type { ReactNode } from "react";
import { classes, type SemanticTone } from "./shared";

export function Banner({
  tone = "info",
  title,
  children,
  action,
  className
}: {
  tone?: SemanticTone | "read-only";
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const urgent = tone === "danger";
  return (
    <section
      className={classes("ry-banner", "access-banner", `ry-tone-${tone}`, className)}
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
    >
      <div>
        <strong>{title}</strong>
        <span>{children}</span>
      </div>
      {action}
    </section>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className
}: {
  tone?: SemanticTone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={classes("ry-alert", `ry-tone-${tone}`, className)}
      role={tone === "danger" ? "alert" : undefined}
    >
      <div>
        {title ? <strong>{title}</strong> : null}
        <div>{children}</div>
      </div>
      {action}
    </section>
  );
}
