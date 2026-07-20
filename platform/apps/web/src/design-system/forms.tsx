import {
  cloneElement,
  isValidElement,
  useId,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from "react";
import { classes, type ComponentSize } from "./shared";

type FieldControl = ReactElement<{
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  disabled?: boolean;
}>;

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const generatedId = useId();
  const existingId = isValidElement(children) ? (children as FieldControl).props.id : undefined;
  const controlId = existingId ?? `field-${generatedId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children as FieldControl, {
        id: (children as FieldControl).props.id ?? controlId,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(error ? { "aria-invalid": true } : {})
      })
    : children;

  return (
    <label className={classes("ry-field", "field", error && "ry-field-error", className)} htmlFor={controlId}>
      <span className="ry-field-label">
        {label}
        {required ? <span className="ry-required"> Required</span> : null}
      </span>
      {control}
      {hint ? <small id={hintId}>{hint}</small> : null}
      {error ? <small className="ry-field-error-text" id={errorId}>{error}</small> : null}
    </label>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  controlSize?: ComponentSize;
  loading?: boolean;
}

export function Input({ controlSize = "default", loading, className, ...props }: InputProps) {
  return (
    <input
      {...props}
      className={classes("ry-input", `ry-control-${controlSize}`, loading && "ry-control-loading", className)}
      aria-busy={loading || undefined}
    />
  );
}

export function SearchInput({
  label,
  loading,
  onClear,
  ...props
}: InputProps & { label: string; onClear?: () => void }) {
  return (
    <div className="ry-search-input" role="search">
      <Input {...props} type="search" aria-label={label} {...(loading === undefined ? {} : { loading })} />
      {onClear && props.value ? (
        <button type="button" className="ry-search-clear" onClick={onClear} aria-label={`Clear ${label}`}>
          Clear
        </button>
      ) : null}
    </div>
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={classes("ry-textarea", className)} />;
}

export function Select({
  controlSize = "default",
  loading,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { controlSize?: ComponentSize; loading?: boolean }) {
  return (
    <select
      {...props}
      className={classes("ry-select", `ry-control-${controlSize}`, loading && "ry-control-loading", className)}
      aria-busy={loading || undefined}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  return (
    <label className={classes("ry-choice", className)}>
      <input {...props} type="checkbox" />
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  );
}

export function Radio({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  return (
    <label className={classes("ry-choice", className)}>
      <input {...props} type="radio" />
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  );
}

export function Switch({
  label,
  description,
  checked,
  onChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="ry-switch">
      <input {...props} type="checkbox" role="switch" checked={checked} onChange={onChange} />
      <span className="ry-switch-track" aria-hidden="true"><span /></span>
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  );
}

export function DatePicker(props: Omit<InputProps, "type">) {
  return <Input {...props} type="date" />;
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  disabled,
  error
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <fieldset className="ry-date-range" aria-describedby={error ? "date-range-error" : undefined}>
      <legend>Date range</legend>
      <Field label="From"><DatePicker value={from} disabled={disabled} onChange={(event) => onFromChange(event.target.value)} /></Field>
      <Field label="To"><DatePicker value={to} disabled={disabled} onChange={(event) => onToChange(event.target.value)} /></Field>
      {error ? <p id="date-range-error" className="ry-field-error-text">{error}</p> : null}
    </fieldset>
  );
}

export function FileUpload({
  label,
  hint,
  status,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
  status?: string;
}) {
  const generatedId = useId();
  const inputId = props.id ?? `file-${generatedId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <label className="ry-field field" htmlFor={inputId}>
      <span className="ry-field-label">{label}</span>
      <span className="ry-file-upload">
        <input {...props} id={inputId} type="file" aria-describedby={hintId} />
        {status ? <span role="status">{status}</span> : null}
      </span>
      {hint ? <small id={hintId}>{hint}</small> : null}
    </label>
  );
}
