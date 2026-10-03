import { useEffect } from "react";
import { Link } from "react-router-dom";
import programJourneyMaterials from "./assets/program-journey-materials.png";

const EXPERIENCE = [
  {
    title: "Industry education",
    body: "Build familiarity with the language, structure, relationships, and workflows that shape brand placement.",
  },
  {
    title: "Guided exploration",
    body: "See how brands, products, buyers, placements, orders, and accounts connect across the commercial process.",
  },
  {
    title: "Guided practice",
    body: "Apply what you’re learning through exercises, decisions, and simulated brand placement scenarios.",
  },
] as const;

const INSIDE = [
  {
    title: "Industry Lessons",
    body: "Focused lessons introduce the commercial concepts behind brand placement without turning the program into an endless textbook.",
  },
  {
    title: "Guided Exercises",
    body: "Short exercises help you notice patterns, evaluate situations, and think through commercial decisions.",
  },
  {
    title: "Ryva Guided Practice",
    body: "Step into realistic scenarios inspired by brand placement workflows and explore how the pieces move together.",
  },
  {
    title: "Final Simulation",
    body: "Bring the program together by following a commercial scenario across brand, product, buyer, placement, and order context.",
  },
] as const;

const FLOW = ["Brand", "Product", "Buyer", "Placement", "Order", "Account"] as const;

const THEMES = [
  {
    title: "Brand placement foundations",
    body: "How brand placement fits between brands, representatives, buyers, and retailers.",
  },
  {
    title: "Brands, products & assortment",
    body: "How products are positioned, reviewed, and considered in a brand placement context.",
  },
  {
    title: "Buyers, accounts & placement",
    body: "How commercial relationships begin and how potential retail fits are explored.",
  },
  {
    title: "Outreach & follow-through",
    body: "Introductions, buyer communication, orders, reorders, and ongoing account context.",
  },
  {
    title: "Commercial relationships & commission",
    body: "How the business continues after the first order and how brand placement compensation commonly works.",
  },
] as const;

const PRACTICE_EXAMPLES = [
  {
    title: "Review an assortment",
    body: "Consider how a product may fit a retail account.",
  },
  {
    title: "Prepare for a buyer conversation",
    body: "Identify the commercial context surrounding a potential placement.",
  },
  {
    title: "Follow an order forward",
    body: "Explore how an opening order can become an ongoing account relationship.",
  },
] as const;

const FORMAT = [
  "8 learning modules",
  "Guided exercises throughout",
  "Ryva practice scenarios",
  "Final simulation",
  "Self-paced access",
] as const;

export function MarketingProgramPage() {
  useEffect(() => {
    document.title = "The Ryva Program · Ryva";
  }, []);

  return (
    <div className="ry-mkt-program">
      <section className="ry-mkt-band-cream ry-mkt-program-hero-band" aria-labelledby="mkt-program-hero">
        <div className="ry-mkt-program-hero ry-mkt-program-hero-text ry-mkt-program-hero-center ry-mkt-reveal">
          <div className="ry-mkt-program-hero-copy">
            <h1 id="mkt-program-hero" className="ry-mkt-display">
              <span className="ry-mkt-display-line">A closer look at</span>
              <span className="ry-mkt-display-accent">brand placement.</span>
            </h1>
            <p className="ry-mkt-lede">
              The Ryva Program is an independent industry education experience designed to help you
              understand how brand placement actually works.
            </p>
            <p className="ry-mkt-lede">
              From brands and products to buyers, placements, orders, accounts, and commissions,
              you’ll explore the systems and decisions behind the business through concise lessons,
              guided exercises, and realistic commercial scenarios.
            </p>
            <div className="ry-mkt-cta-row">
              <Link className="ry-mkt-btn ry-mkt-btn-primary" to="/signup">
                Join The Ryva Program
              </Link>
              <Link className="ry-mkt-btn ry-mkt-btn-secondary" to="/curriculum">
                View Curriculum
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-deep" aria-labelledby="mkt-program-experience">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-program-experience">
          <div className="ry-mkt-program-experience-head">
            <h2 id="mkt-program-experience" className="ry-mkt-title">
              Learn it. See it. Work through it.
            </h2>
            <p className="ry-mkt-lede">
              Ryva is designed around three parts of the learning experience.
            </p>
          </div>
          <div className="ry-mkt-program-experience-stage">
            <div className="ry-mkt-program-columns">
              {EXPERIENCE.map((item) => (
                <article key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-taupe" aria-labelledby="mkt-program-inside">
        <div className="ry-mkt-section ry-mkt-program-section">
          <div className="ry-mkt-program-intro">
            <h2 id="mkt-program-inside" className="ry-mkt-title">
              More than a series of lessons.
            </h2>
          </div>
          <div className="ry-mkt-program-inside-list">
            {INSIDE.map((block) => (
              <article key={block.title} className="ry-mkt-program-inside-item">
                <h3>{block.title}</h3>
                <p>{block.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-dark ry-mkt-program-journey-band" aria-labelledby="mkt-program-journey">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-program-journey">
          <div className="ry-mkt-program-journey-copy">
            <h2 id="mkt-program-journey" className="ry-mkt-title">
              Follow the product beyond the brand.
            </h2>
            <p className="ry-mkt-lede">
              Brand placement is not one transaction. It is a chain of commercial relationships.
            </p>
            <ol
              className="ry-mkt-flow-sequence ry-mkt-flow-sequence-dark"
              aria-label="Brand placement commercial flow"
            >
              {FLOW.map((item) => (
                <li key={item}>
                  <span className="ry-mkt-flow-label">{item}</span>
                </li>
              ))}
            </ol>
            <p className="ry-mkt-lede">
              The Ryva Program helps you understand what happens at each stage, why it matters, and
              how the stages influence one another.
            </p>
          </div>
          <div className="ry-mkt-program-journey-visual" aria-hidden="true">
            <img
              className="ry-mkt-program-journey-img"
              src={programJourneyMaterials}
              alt=""
              decoding="async"
            />
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-cream" aria-labelledby="mkt-program-curriculum">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-program-curriculum">
          <div className="ry-mkt-program-intro">
            <h2 id="mkt-program-curriculum" className="ry-mkt-title">
              The business behind the brands.
            </h2>
          </div>
          <div className="ry-mkt-program-themes">
            {THEMES.map((theme) => (
              <article key={theme.title} className="ry-mkt-program-theme">
                <h3>{theme.title}</h3>
                <p>{theme.body}</p>
              </article>
            ))}
          </div>
          <div className="ry-mkt-cta-row ry-mkt-cta-row-flush">
            <Link className="ry-mkt-btn ry-mkt-btn-secondary" to="/curriculum">
              Explore the full curriculum
            </Link>
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-deep" aria-labelledby="mkt-program-practice">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-program-practice">
          <div className="ry-mkt-program-practice-main">
            <div className="ry-mkt-program-practice-copy">
              <h2 id="mkt-program-practice" className="ry-mkt-title">
                Understanding is different when you have to make the decision.
              </h2>
              <p className="ry-mkt-lede">
                Ryva guided practice places you inside structured commercial scenarios where you may
                be asked to review information, interpret a situation, choose a next step, or follow
                a brand placement relationship as it develops.
              </p>
              <p className="ry-mkt-lede">
                The scenarios are designed for learning and exploration, not to imitate a particular
                employer or promise job readiness.
              </p>
            </div>
            <div className="ry-mkt-device" aria-hidden="true">
              <div className="ry-mkt-device-bar">
                <i />
                <i />
                <i />
              </div>
              <div className="ry-mkt-device-screen">
                <div className="ry-mkt-device-rail">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="ry-mkt-device-panel">
                  <div className="ry-mkt-mock-label">Scenario · Placement review</div>
                  <strong>Buyer appointment brief</strong>
                  <ul className="ry-mkt-mock-rows">
                    <li>
                      <span>Brand</span>
                      <span>Maison North</span>
                    </li>
                    <li>
                      <span>Account</span>
                      <span>Atelier Market</span>
                    </li>
                    <li>
                      <span>Focus</span>
                      <span>Assortment fit</span>
                    </li>
                    <li>
                      <span>Next</span>
                      <span>Order context</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="ry-mkt-program-examples">
            {PRACTICE_EXAMPLES.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-dark ry-mkt-program-sim-band" aria-labelledby="mkt-program-simulation">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-program-sim">
          <h2 id="mkt-program-simulation" className="ry-mkt-display">
            Bring the entire system together.
          </h2>
          <div className="ry-mkt-program-sim-copy">
            <p className="ry-mkt-lede">
              At the end of the program, you’ll work through a longer guided scenario that connects
              the concepts introduced throughout Ryva.
            </p>
            <p className="ry-mkt-lede">
              You’ll move through the commercial context of a brand, its product, a prospective
              buyer, a placement opportunity, and the resulting order relationship.
            </p>
            <p className="ry-mkt-pull">
              It is designed to help you apply and connect what you explored throughout the program.
            </p>
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-cream" aria-labelledby="mkt-program-format">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-program-format-band">
          <div className="ry-mkt-program-format-copy">
            <h2 id="mkt-program-format" className="ry-mkt-title">
              Designed to fit into real life.
            </h2>
            <p className="ry-mkt-pull">Focused enough to finish. Substantial enough to matter.</p>
            <p className="ry-mkt-lede">Complete The Ryva Program at your own pace.</p>
          </div>
          <ul className="ry-mkt-program-format" aria-label="Program format">
            {FORMAT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ry-mkt-band-deep" aria-labelledby="mkt-program-who">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-program-who">
          <h2 id="mkt-program-who" className="ry-mkt-title">
            You do not need to already work in brand placement.
          </h2>
          <div className="ry-mkt-program-who-copy">
            <p className="ry-mkt-lede">
              The Ryva Program is designed for people who are curious about brand placement, brands,
              retail, commercial relationships, or the business behind how products reach stores. No
              prior brand placement experience is required.
            </p>
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-cream" aria-labelledby="mkt-program-note">
        <div className="ry-mkt-section ry-mkt-program-note">
          <h2 id="mkt-program-note" className="ry-mkt-program-note-title">
            A note about The Ryva Program
          </h2>
          <p>
            Ryva provides independent industry education, exploration, and guided practice. It is
            not a professional certification, licensure program, job-placement service, or guarantee
            of employment.
          </p>
        </div>
      </section>

      <section className="ry-mkt-band-dark ry-mkt-program-cta-band" aria-labelledby="mkt-program-cta">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-program-cta">
          <h2 id="mkt-program-cta" className="ry-mkt-display">
            See brand placement differently.
          </h2>
          <p className="ry-mkt-lede">Industry education. Commercial context. Guided practice.</p>
          <div className="ry-mkt-cta-row">
            <Link className="ry-mkt-btn ry-mkt-btn-primary" to="/signup">
              Join The Ryva Program
            </Link>
            <Link className="ry-mkt-btn ry-mkt-btn-secondary ry-mkt-btn-on-dark" to="/curriculum">
              Explore the Curriculum
            </Link>
          </div>
          <p className="ry-mkt-program-cta-foot">
            Independent industry education and guided practice.
          </p>
        </div>
      </section>
    </div>
  );
}
