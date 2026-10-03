import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { Tabs } from "../../design-system";

export type CommercialNavContext = {
  accountId?: string;
  protectionId?: string;
  orderId?: string;
  reorderPath?: string;
  commissionId?: string;
  disputeId?: string;
};

function isSection(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function withAccount(path: string, accountId: string): string {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}accountId=${encodeURIComponent(accountId)}`;
}

/** Preserves commercial continuity links required by existing e2e and workflows. */
export function CommercialSubnav({ context }: { context?: CommercialNavContext } = {}) {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const accountId = context?.accountId?.trim() || searchParams.get("accountId")?.trim() || "";
  const protectionId = context?.protectionId?.trim() || "";
  const orderId = context?.orderId?.trim() || "";
  const commissionId = context?.commissionId?.trim() || "";
  const disputeId = context?.disputeId?.trim() || "";
  const reorderPath = context?.reorderPath?.trim() || "";

  // Already in this section (detail or scoped register): second click returns to the register root.
  const accountsTo = isSection(pathname, "/accounts")
    ? "/accounts"
    : accountId
      ? `/accounts/${accountId}`
      : "/accounts";

  const protectionTo = isSection(pathname, "/protected-accounts")
    ? "/protected-accounts"
    : protectionId
      ? `/protected-accounts/${protectionId}`
      : accountId
        ? withAccount("/protected-accounts", accountId)
        : "/protected-accounts";

  const ordersTo = isSection(pathname, "/orders")
    ? "/orders"
    : orderId
      ? `/orders/${orderId}`
      : accountId
        ? withAccount("/orders", accountId)
        : "/orders";

  const reordersTo = isSection(pathname, "/reorders")
    ? "/reorders"
    : reorderPath
      ? reorderPath
      : accountId
        ? withAccount("/reorders", accountId)
        : "/reorders";

  const commissionsTo = isSection(pathname, "/commissions")
    ? "/commissions"
    : commissionId
      ? `/commissions/${commissionId}`
      : accountId
        ? withAccount("/commissions", accountId)
        : "/commissions";

  const disputesTo = isSection(pathname, "/commission-disputes")
    ? "/commission-disputes"
    : disputeId
      ? `/commission-disputes/${disputeId}`
      : accountId
        ? withAccount("/commission-disputes", accountId)
        : "/commission-disputes";

  return (
    <Tabs label="Commercial operations" className="ry-commerce-subnav">
      <NavLink to={accountsTo} className={() => (isSection(pathname, "/accounts") ? "active" : undefined)}>
        Accounts
      </NavLink>
      <NavLink to={protectionTo} className={() => (isSection(pathname, "/protected-accounts") ? "active" : undefined)}>
        Protection
      </NavLink>
      <NavLink to={ordersTo} className={() => (isSection(pathname, "/orders") ? "active" : undefined)}>
        Orders
      </NavLink>
      <NavLink to={reordersTo} className={() => (isSection(pathname, "/reorders") ? "active" : undefined)}>
        Reorders
      </NavLink>
      <NavLink to={commissionsTo} className={() => (isSection(pathname, "/commissions") ? "active" : undefined)}>
        Commissions
      </NavLink>
      <NavLink to={disputesTo} className={() => (isSection(pathname, "/commission-disputes") ? "active" : undefined)}>
        Disputes
      </NavLink>
    </Tabs>
  );
}
