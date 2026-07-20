import type { ButtonHTMLAttributes, ReactNode } from "react";
import { classes, type ComponentSize } from "./shared";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ComponentSize;
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "default",
  loading = false,
  leading,
  trailing,
  children,
  className,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={classes("ry-button", `ry-button-${variant}`, `ry-control-${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="ry-spinner" aria-hidden="true" /> : leading}
      <span>{children}</span>
      {trailing}
    </button>
  );
}

export function ButtonGroup({
  children,
  label,
  className
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div className={classes("ry-button-group", className)} role={label ? "group" : undefined} aria-label={label}>
      {children}
    </div>
  );
}
