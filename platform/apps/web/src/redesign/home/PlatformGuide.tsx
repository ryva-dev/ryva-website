import { useState } from "react";
import { Link } from "react-router-dom";
import { appPath } from "../../appBase";
import { Button, Dialog } from "../../design-system";

type GuideStep = {
  title: string;
  summary: string;
  actions: string[];
  links: Array<{ label: string; to: string }>;
};

const guideSteps: GuideStep[] = [
  {
    title: "1. Learn the workflow",
    summary: "Begin with the Program, then use Ryva Pro to manage the commercial work the Program teaches.",
    actions: [
      "Complete Program lessons, guided practice, the final simulation, and the final assessment.",
      "Use Home after Program completion to see priorities, upcoming activity, pipeline health, and commercial changes.",
      "Treat Ryva as the system of record: preserve sources, decisions, authority, and next actions as work develops."
    ],
    links: [
      { label: "Open the Program", to: "/program" },
      { label: "Return to Home", to: "/" }
    ]
  },
  {
    title: "2. Build your commercial foundation",
    summary: "Create the records that describe what is being represented, who may buy it, and where each fact came from.",
    actions: [
      "Register Sources before relying on research. A source records provenance; it does not automatically prove a claim.",
      "Add Brands and Products, then record wholesale details, research findings, confidence, and limitations.",
      "Add Businesses & Buyers, then connect professional Contacts to the correct Brand or Business.",
      "Verify contact routes against an active source before marking a Brand or Business ready for contact."
    ],
    links: [
      { label: "Sources", to: "/sources" },
      { label: "Brands", to: "/brands" },
      { label: "Products", to: "/products" },
      { label: "Businesses & Buyers", to: "/buyers" }
    ]
  },
  {
    title: "3. Establish representation authority",
    summary: "Representation is a documented relationship—not an assumption created by adding a Brand.",
    actions: [
      "Create a representation opportunity only after the Brand and relevant Products are understood.",
      "Upload and review the agreement, record exact approved terms, scope, territory, channels, and restrictions.",
      "Activate representation only after human approval. Ryva blocks represented activity when current authority is absent.",
      "Keep the original agreement and supporting documents attached for later review."
    ],
    links: [
      { label: "Representation", to: "/representation" },
      { label: "Documents", to: "/documents" }
    ]
  },
  {
    title: "4. Qualify and manage placements",
    summary: "A Placement connects an authorized Brand and Product opportunity to an appropriate retail Business.",
    actions: [
      "Create a Placement only when the Brand, Business, Product scope, fit rationale, and authority are clear.",
      "Move through stages as real evidence changes—not simply because time has passed.",
      "Record the next action as a Task, including a responsible owner and useful due date.",
      "Use Home and Analytics to find stalled, blocked, or missing-next-action opportunities."
    ],
    links: [
      { label: "Placements", to: "/placements" },
      { label: "Tasks", to: "/tasks" },
      { label: "Analytics", to: "/analytics" }
    ]
  },
  {
    title: "5. Prepare and record outreach",
    summary: "Outreach should have a legitimate purpose, a verified route, permission, and a specific commercial reason.",
    actions: [
      "Confirm the recipient, professional contact route, permission state, and representation authority.",
      "Draft the message from the Placement so the Brand, Business, Products, and rationale remain connected.",
      "Review the exact recipient, subject, body, and authority before approval or sending.",
      "Record replies, calls, objections, follow-ups, and the next action instead of relying on an inbox alone."
    ],
    links: [
      { label: "Outreach", to: "/outreach" },
      { label: "Templates", to: "/outreach/templates" },
      { label: "Sequences", to: "/outreach/sequences" }
    ]
  },
  {
    title: "6. Preserve orders and commercial continuity",
    summary: "Move from opportunity to account history without losing the documents and terms behind the numbers.",
    actions: [
      "Create an Account when a real retailer relationship exists; do not treat a prospect as an active account.",
      "Record opening Orders from source documents and verify totals, dates, Brand, Business, and agreement scope.",
      "Track Reorders as subsequent purchasing events with an expected window and next action.",
      "Review expected, approved, payable, paid, disputed, and overdue Commissions separately."
    ],
    links: [
      { label: "Accounts", to: "/accounts" },
      { label: "Orders", to: "/orders" },
      { label: "Reorders", to: "/reorders" },
      { label: "Commissions", to: "/commissions" }
    ]
  },
  {
    title: "7. Review performance and maintain records",
    summary: "Use reporting to understand the work while keeping imports, exports, notifications, and documents controlled.",
    actions: [
      "Review Analytics for pipeline movement, commercial activity, account health, and commission status.",
      "Use Notifications for changes that need attention and Home for the current priority queue.",
      "Preview imports before approval; imported assertions remain reviewable and do not create authority by themselves.",
      "Use exports for controlled portability, and keep documents private until malware scanning marks them clean."
    ],
    links: [
      { label: "Analytics", to: "/analytics" },
      { label: "Notifications", to: "/notifications" },
      { label: "Data import", to: "/imports" },
      { label: "Data export", to: "/exports" }
    ]
  },
  {
    title: "8. Account, access, and getting unstuck",
    summary: "Personal account controls remain separate from workspace operations and commercial records.",
    actions: [
      "Use Profile and Settings to manage identity, password, sessions, notification preferences, and account closure.",
      "Use Product access and Subscription to understand Program ownership, included Pro access, and paid Pro status.",
      "If a record will not advance, read the blocker and check identity, source evidence, verified contacts, authority, risks, and the linked next action.",
      "A successful save and a blocked stage change can appear together: the detail was saved, but a separate advancement requirement is still missing.",
      "If the message still does not identify the missing requirement, contact support@ryvaforge.com with the page and record name—never send a password or secret."
    ],
    links: [
      { label: "Profile", to: "/profile" },
      { label: "Settings", to: "/settings" },
      { label: "Product access", to: "/access" },
      { label: "Subscription", to: "/subscription" }
    ]
  }
];

export function PlatformGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = guideSteps[activeIndex] ?? guideSteps[0]!;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Ryva field guide"
      title="How to use the Ryva platform"
      description="A practical path from learning and research through placements, orders, reorders, and commissions."
      className="ry-platform-guide-dialog"
      footer={<Button variant="secondary" onClick={onClose}>Close guide</Button>}
    >
      <div className="ry-platform-guide-layout">
        <nav className="ry-platform-guide-nav" aria-label="Platform guide sections">
          {guideSteps.map((step, index) => (
            <button
              key={step.title}
              type="button"
              className={index === activeIndex ? "active" : ""}
              aria-current={index === activeIndex ? "step" : undefined}
              onClick={() => setActiveIndex(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {step.title.replace(/^\d+\.\s*/, "")}
            </button>
          ))}
        </nav>

        <article className="ry-platform-guide-content" aria-live="polite">
          <p className="ry-platform-guide-step">Step {activeIndex + 1} of {guideSteps.length}</p>
          <h3>{active.title}</h3>
          <p className="ry-platform-guide-summary">{active.summary}</p>
          <ol>
            {active.actions.map((action) => <li key={action}>{action}</li>)}
          </ol>
          <div className="ry-platform-guide-links" aria-label="Open related areas">
            {active.links.map((link) => (
              <Link key={link.to} to={appPath(link.to)} onClick={onClose}>{link.label} →</Link>
            ))}
          </div>
          <div className="ry-platform-guide-pager">
            <Button
              variant="tertiary"
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={activeIndex === guideSteps.length - 1}
              onClick={() => setActiveIndex((current) => Math.min(guideSteps.length - 1, current + 1))}
            >
              Next step
            </Button>
          </div>
        </article>
      </div>
    </Dialog>
  );
}
