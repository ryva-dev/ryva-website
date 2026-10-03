import { useEffect } from "react";
import { Link } from "react-router-dom";

const MODULES = [
  {
    num: "01",
    title: "Inside Brand Placement",
    lead: "Start with the landscape.",
    body: "Explore what brand placement is, how it differs from direct-to-consumer retail, where representatives fit, and how products move from brands toward retail accounts.",
    explore: "Brands · representatives · retailers · buyers · brand placement relationships",
  },
  {
    num: "02",
    title: "Brands, Products, Assortment & Commercial Readiness",
    lead: "A product is not evaluated in isolation.",
    body: "Explore positioning, SKUs, line sheets, seasonality, pricing, retailer margin, minimums, and the commercial information behind a product line.",
    explore: "Positioning · SKUs · line sheets · margin · minimums · commercial readiness",
  },
  {
    num: "03",
    title: "Buyers, Retail Accounts & Commercial Fit",
    lead: "Understand the people and businesses on the other side of the relationship.",
    body: "Learn how different retailers think about assortment, customer, inventory, margin, category needs, and account fit.",
    explore: "Account types · buyer roles · research · fit matrix · retailer economics",
  },
  {
    num: "04",
    title: "Placement Strategy, Territory & Opportunity Prioritization",
    lead: "Not every retailer is the right retailer.",
    body: "Explore how potential accounts are compared, timed, prioritized, and considered within larger brand and territory context.",
    explore: "Fit · probability · potential · territory · channel conflict · pipeline",
  },
  {
    num: "05",
    title: "Outreach, Buyer Communication & Appointments",
    lead: "Commercial relationships begin with communication.",
    body: "Learn how relevant commercial conversations begin, how to prepare, how to follow up, and how to communicate without noise or inflated claims.",
    explore: "Reasons to reach out · introductions · follow-up · meetings · boundaries",
  },
  {
    num: "06",
    title: "Orders, Terms, Fulfillment & Reorders",
    lead: "An opening order is only one moment in the relationship.",
    body: "Understand purchase orders, order calculations, terms, verification, changes, fulfillment, and what continued purchasing can reveal.",
    explore: "Order anatomy · terms · verification · adjustments · sell-through · reorders",
  },
  {
    num: "07",
    title: "Account Development & Commercial Performance",
    lead: "Brand placement is built over time.",
    body: "Explore sell-through, reorder rate, average order value, account growth, portfolio concentration, and what account activity can mean in context.",
    explore: "Account development · sell-through · AOV · growth · concentration · health",
  },
  {
    num: "08",
    title: "Commissions, Commercial Judgment & Ryva",
    lead: "Understand how brand placement representatives are commonly compensated.",
    body: "Understand commission structures, adjustments, expected versus paid compensation, record accuracy, and how the entire commercial journey comes together inside Ryva.",
    explore: "Commission math · adjustments · splits · record integrity · Ryva workflow",
  },
] as const;

const PRACTICE_BEATS = [
  "You might compare potential retail accounts.",
  "Review a product assortment.",
  "Consider how to approach a buyer.",
  "Interpret what happened after an order.",
  "Or decide what you would do next.",
] as const;

export function MarketingCurriculumPage() {
  useEffect(() => {
    document.title = "Curriculum · Ryva";
  }, []);

  return (
    <div className="ry-mkt-curriculum-page">
      <section className="ry-mkt-band-cream" aria-labelledby="mkt-curr-hero">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-curr-hero">
          <h1 id="mkt-curr-hero" className="ry-mkt-display">
            Learn the business behind the brands.
          </h1>
          <p className="ry-mkt-lede">
            The Ryva curriculum follows the commercial journey of brand placement, beginning with
            the structure of the industry and moving through brands, products, buyers, placements,
            orders, accounts, and compensation.
          </p>
          <p className="ry-mkt-lede">The goal is not to overwhelm you with theory.</p>
          <p className="ry-mkt-lede">
            It is to give you enough context to understand what you are looking at when the pieces
            begin moving together.
          </p>
          <div className="ry-mkt-cta-row">
            <Link className="ry-mkt-btn ry-mkt-btn-primary" to="/signup">
              Join The Ryva Program
            </Link>
            <Link className="ry-mkt-btn ry-mkt-btn-secondary" to="/how-it-works">
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-deep" aria-labelledby="mkt-curr-modules">
        <div className="ry-mkt-section ry-mkt-program-section">
          <h2 id="mkt-curr-modules" className="ry-mkt-title">
            Eight modules. One commercial journey.
          </h2>
          <ol className="ry-mkt-curriculum ry-mkt-curriculum-full">
            {MODULES.map((mod) => (
              <li key={mod.num}>
                <span className="ry-mkt-curriculum-num" aria-hidden="true">
                  {mod.num}
                </span>
                <div className="ry-mkt-curriculum-body">
                  <strong>{mod.title}</strong>
                  <p className="ry-mkt-curriculum-lead">{mod.lead}</p>
                  <p>{mod.body}</p>
                  <p className="ry-mkt-curriculum-explore">You’ll explore: {mod.explore}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="ry-mkt-band-cream" aria-labelledby="mkt-curr-practice">
        <div className="ry-mkt-section ry-mkt-program-section">
          <div className="ry-mkt-program-intro">
            <h2 id="mkt-curr-practice" className="ry-mkt-title">
              Learn something. Then use it.
            </h2>
            <p className="ry-mkt-lede">
              The curriculum is paired with short guided exercises and commercial scenarios designed
              to help you interpret what you are learning in context.
            </p>
          </div>
          <ul className="ry-mkt-works-facts ry-mkt-works-facts-wide">
            {PRACTICE_BEATS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="ry-mkt-lede">
            The scenarios are designed for exploration and applied learning. Program completion does
            not promise employment, income, or occupational status.
          </p>
        </div>
      </section>

      <section className="ry-mkt-band-wine" aria-labelledby="mkt-curr-sim">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-works-sim">
          <h2 id="mkt-curr-sim" className="ry-mkt-display">
            Follow the relationship from beginning to next step.
          </h2>
          <p className="ry-mkt-lede">
            At the end of the program, the separate concepts become one connected scenario.
          </p>
          <p className="ry-mkt-lede">
            You’ll move through the commercial context surrounding a brand, product, prospective
            buyer, placement opportunity, communication, order, and ongoing account relationship.
          </p>
          <p className="ry-mkt-lede">
            You’ll then complete a 50-question Final Brand Placement Assessment covering concepts,
            scenarios, calculations, and commercial interpretation. An 80% score is required to
            complete The Ryva Program and unlock Ryva.
          </p>
          <p className="ry-mkt-pull ry-mkt-pull-spaced">
            There is one question underneath the entire experience: What would you pay attention to
            next?
          </p>
          <div className="ry-mkt-cta-row">
            <Link className="ry-mkt-btn ry-mkt-btn-on-dark" to="/the-program">
              Explore The Ryva Program
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
