import { NavLink } from "react-router-dom";
import { Tabs } from "../../design-system";

/** Preserves commercial continuity links required by existing e2e and workflows. */
export function CommercialSubnav() {
  return (
    <Tabs label="Commercial operations" className="ry-commerce-subnav">
      <NavLink to="/accounts">Accounts</NavLink>
      <NavLink to="/protected-accounts">Protection</NavLink>
      <NavLink to="/orders">Orders</NavLink>
      <NavLink to="/reorders">Reorders</NavLink>
      <NavLink to="/commissions">Commissions</NavLink>
      <NavLink to="/commission-disputes">Disputes</NavLink>
    </Tabs>
  );
}
