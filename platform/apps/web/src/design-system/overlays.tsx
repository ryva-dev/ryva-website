import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./actions";
import type { ButtonVariant } from "./actions";
import { classes } from "./shared";

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(
    "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
  )).filter((element) => !element.hasAttribute("hidden"));
}

export function Drawer({
  open,
  title,
  description,
  meta,
  children,
  onClose,
  size = "standard",
  closeLabel = "Close",
  className
}: {
  open: boolean;
  title: string;
  description?: string;
  meta?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  size?: "narrow" | "standard" | "wide";
  closeLabel?: string;
  className?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const root = document.getElementById("root");
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (root) root.inert = true;
    document.body.classList.add("ry-overlay-open");

    const panel = panelRef.current;
    const focusables = panel ? focusableElements(panel) : [];
    (focusables[0] ?? panel)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const current = focusableElements(panel);
      if (!current.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = current[0];
      const last = current[current.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (root) root.inert = false;
      document.body.classList.remove("ry-overlay-open");
      returnFocusRef.current?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="ry-drawer-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className={classes("ry-drawer", `ry-drawer-${size}`, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="ry-drawer-header">
          <div>
            <p className="eyebrow">Contextual review</p>
            <h2 id={titleId}>{title}</h2>
            {meta ? <div className="ry-drawer-meta">{meta}</div> : null}
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <Button
            variant="tertiary"
            size="compact"
            className="ry-drawer-close"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Button>
        </header>
        <div className="ry-drawer-body">{children}</div>
      </section>
    </div>,
    document.body
  );
}

export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  footer,
  eyebrow,
  closeLabel = "Close",
  className,
  size = "standard"
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  eyebrow?: string;
  closeLabel?: string;
  className?: string;
  size?: "narrow" | "standard";
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const root = document.getElementById("root");
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (root) root.inert = true;
    document.body.classList.add("ry-overlay-open");

    const panel = panelRef.current;
    const focusables = panel ? focusableElements(panel) : [];
    (focusables[0] ?? panel)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const current = focusableElements(panel);
      if (!current.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = current[0];
      const last = current[current.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (root) root.inert = false;
      document.body.classList.remove("ry-overlay-open");
      returnFocusRef.current?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="ry-dialog-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className={classes("ry-dialog", `ry-dialog-${size}`, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="ry-dialog-header">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <Button
            variant="tertiary"
            size="compact"
            className="ry-dialog-close"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Button>
        </header>
        <div className="ry-dialog-body">{children}</div>
        {footer ? <div className="ry-dialog-footer">{footer}</div> : null}
      </section>
    </div>,
    document.body
  );
}

export function ConfirmationDialog({
  open,
  title,
  description,
  consequence,
  confirmLabel,
  onConfirm,
  onClose,
  confirmVariant = "primary",
  processing = false,
  error
}: {
  open: boolean;
  title: string;
  description: string;
  consequence: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  confirmVariant?: ButtonVariant;
  processing?: boolean;
  error?: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const consequenceId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const processingRef = useRef(processing);
  onCloseRef.current = onClose;
  processingRef.current = processing;

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const root = document.getElementById("root");
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (root) root.inert = true;
    document.body.classList.add("ry-overlay-open");

    const panel = panelRef.current;
    const focusables = panel ? focusableElements(panel) : [];
    (focusables[0] ?? panel)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !processingRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const current = focusableElements(panel);
      if (!current.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = current[0];
      const last = current[current.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (root) root.inert = false;
      document.body.classList.remove("ry-overlay-open");
      returnFocusRef.current?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="ry-dialog-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !processing) onClose();
      }}
    >
      <section
        ref={panelRef}
        className="ry-confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${descriptionId} ${consequenceId}`}
        aria-busy={processing || undefined}
        tabIndex={-1}
      >
        <header>
          <p className="eyebrow">Final confirmation</p>
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
        </header>
        <div id={consequenceId} className="ry-confirmation-consequence">
          <div className="ry-confirmation-consequence-body">{consequence}</div>
        </div>
        {error ? <div className="ry-field-error-text" role="alert">{error}</div> : null}
        <div className="ry-button-group">
          <Button variant="secondary" disabled={processing} onClick={onClose}>Cancel</Button>
          <Button variant={confirmVariant} loading={processing} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </section>
    </div>,
    document.body
  );
}
