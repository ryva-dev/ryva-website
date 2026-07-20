import {
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  StatusLabel
} from "./design-system";
import { ApplicationShell } from "./redesign/shell/ApplicationShell";

export function Loading({ label = "Loading" }: { label?: string }) {
  return <LoadingState label={label} />;
}

export function ErrorPanel({ message }: { message: string }) {
  return <ErrorState message={message} />;
}

export function StatusPill({ value }: { value: string }) {
  return <StatusLabel value={value} />;
}

export { Field, PageHeader };

export function ProtectedLayout() {
  return <ApplicationShell />;
}
