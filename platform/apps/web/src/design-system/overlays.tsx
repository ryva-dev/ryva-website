import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./actions";
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
  children,
  onClose,
  size = "standard",
  closeLabel = "Close",
  className
}: {
  open: boolean;
  title: string;
  description?: string;
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
        onClose();
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
  }, [onClose, open]);

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
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <Button variant="tertiary" onClick={onClose}>{closeLabel}</Button>
        </header>
        <div className="ry-drawer-body">{children}</div>
      </section>
    </div>,
    document.body
  );
}
