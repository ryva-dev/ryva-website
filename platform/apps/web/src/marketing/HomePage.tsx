import { Link } from "react-router-dom";
import heroGlobe from "./assets/hero-globe.png";

const MODULES = [
  {
    num: "01",
    title: "Inside brand placement",
    body: "How products move from brand to retailer.",
  },
  {
    num: "02",
    title: "Brands, products & assortment",
    body: "How products are positioned and evaluated in a brand placement context.",
  },
  {
    num: "03",
    title: "Buyers & retail accounts",
    body: "Who buyers are and how commercial relationships develop.",
  },
  {
    num: "04",
    title: "Placement strategy",
    body: "How potential retail fits are identified and explored.",
  },
  {
    num: "05",
    title: "Brand placement outreach",
    body: "The communication behind introductions and follow-up.",
  },
  {
    num: "06",
    title: "Orders & reorders",
    body: "What happens after a retailer places an order.",
  },
  {
    num: "07",
    title: "Commercial relationships",
    body: "How brands, representatives, buyers, and accounts work together.",
  },
  {
    num: "08",
    title: "Commission structure",
    body: "How brand placement compensation commonly works.",
  },
] as const;

const VALUE_BLOCKS = [
  {
    title: "Industry Lessons",
    body: "Concise lessons explaining the structure and commercial language of brand placement.",
  },
  {
    title: "Guided Exercises",
    body: "Apply concepts through decisions, observations, and short exercises.",
  },
  {
    title: "Ryva Guided Practice",
    body: "Explore realistic brand placement scenarios inside the Ryva environment.",
  },
  {
    title: "Final Simulation",
    body: "Follow a commercial scenario from brand and product through buyer, placement, and order context.",
  },
] as const;

const FAQS = [
  {
    q: "Is this a certification?",
    a: "No. The Ryva Program is an independent industry education and guided-practice experience. It is designed to help participants explore and understand brand placement concepts and workflows; it does not provide professional licensure, academic credit, or a state-recognized credential.",
  },
  {
    q: "Who is The Ryva Program for?",
    a: "Anyone curious about the business behind the brands, whether you are exploring brand placement for the first time, already interested in brands, retail, or sales, or simply want to understand how the industry works. No prior brand placement experience is required.",
  },
  {
    q: "What is guided practice?",
    a: "Guided practice lets you apply what you are learning through realistic commercial scenarios and structured decisions inside the Ryva environment, after you have built context through lessons and exercises.",
  },
  {
    q: "Is this job training or placement?",
    a: "No. Ryva does not place participants in jobs, guarantee career outcomes, or authorize professional practice. It is industry education and guided practice focused on understanding brand placement.",
  },
] as const;

const FLOW = ["Brand", "Product", "Buyer", "Placement", "Order", "Account"] as const;

export function MarketingHomePage() {
  return (
    <>
      <section className="ry-mkt-band-cream" aria-labelledby="mkt-home-hero">
        <div className="ry-mkt-hero ry-mkt-reveal">
          <div className="ry-mkt-hero-copy">
            <h1 id="mkt-home-hero" className="ry-mkt-display">
              <span className="ry-mkt-display-line">Step inside the world of</span>
              <span className="ry-mkt-display-accent">brand placement.</span>
            </h1>
            <p className="ry-mkt-lede">
              Explore how brand placement works through industry education, commercial context, and
              guided practice.
            </p>
            <div className="ry-mkt-cta-row">
              <Link className="ry-mkt-btn ry-mkt-btn-primary" to="/the-program">
                Explore The Program
              </Link>
              <Link className="ry-mkt-btn ry-mkt-btn-secondary" to="/how-it-works">
                See How It Works
              </Link>
            </div>
          </div>

          <div className="ry-mkt-hero-visual" aria-hidden="true">
            <div className="ry-mkt-hero-globe">
              <div className="ry-mkt-globe-frame">
                <img className="ry-mkt-globe-img" src={heroGlobe} alt="" decoding="async" />
              </div>
              <p className="ry-mkt-hero-globe-caption">Brands finding their place.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ry-mkt-pillars-band" aria-label="Program pillars">
        <div className="ry-mkt-pillars">
          <article className="ry-mkt-pillar">
            <h3>Understand</h3>
            <p>Learn the structure, language, roles, and workflows behind brand placement.</p>
          </article>
          <article className="ry-mkt-pillar">
            <h3>Explore</h3>
            <p>See how brands, products, buyers, placements, orders, and accounts connect.</p>
          </article>
          <article className="ry-mkt-pillar">
            <h3>Practice</h3>
            <p>Work through guided scenarios and realistic simulations inspired by brand placement workflows.</p>
          </article>
        </div>
      </section>

      <section className="ry-mkt-band-cream" aria-labelledby="mkt-connect">
        <div className="ry-mkt-section">
          <div className="ry-mkt-connect-intro">
            <h2 id="mkt-connect" className="ry-mkt-title">
              See how the pieces connect.
            </h2>
            <p className="ry-mkt-lede">
              Ryva explores how these commercial relationships move together across the brand placement
              process.
            </p>
          </div>

          <ol className="ry-mkt-flow-sequence" aria-label="Brand placement commercial flow">
            {FLOW.map((item) => (
              <li key={item}>
                <span className="ry-mkt-flow-label">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="ry-mkt-band-deep" aria-labelledby="mkt-inside">
        <div className="ry-mkt-section">
          <div className="ry-mkt-value-head">
            <h2 id="mkt-inside" className="ry-mkt-title">
              What’s inside The Ryva Program
            </h2>
          </div>
          <div className="ry-mkt-value-list">
            {VALUE_BLOCKS.map((block) => (
              <article key={block.title} className="ry-mkt-value-item">
                <h3>{block.title}</h3>
                <p>{block.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-cream" aria-labelledby="mkt-curriculum" id="curriculum">
        <div className="ry-mkt-section">
          <div className="ry-mkt-curriculum-intro">
            <h2 id="mkt-curriculum" className="ry-mkt-title">
              What you’ll explore.
            </h2>
          </div>
          <ol className="ry-mkt-curriculum">
            {MODULES.map((mod) => (
              <li key={mod.num}>
                <span className="ry-mkt-curriculum-num" aria-hidden="true">
                  {mod.num}
                </span>
                <div className="ry-mkt-curriculum-body">
                  <strong>{mod.title}</strong>
                  <p>{mod.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="ry-mkt-cta-row">
            <Link className="ry-mkt-btn ry-mkt-btn-secondary" to="/curriculum">
              View full curriculum
            </Link>
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-dark" aria-labelledby="mkt-who">
        <div className="ry-mkt-section ry-mkt-who">
          <div className="ry-mkt-who-intro">
            <h2 id="mkt-who" className="ry-mkt-title">
              For anyone curious about the business behind the brands.
            </h2>
          </div>
          <div className="ry-mkt-who-split">
            <ul className="ry-mkt-who-lines">
              <li>You may be exploring brand placement for the first time.</li>
              <li>You may already be interested in brands, retail, or sales.</li>
              <li>You may simply want to understand how the industry works.</li>
            </ul>
            <aside className="ry-mkt-who-aside">
              <p className="ry-mkt-who-highlight">
                Industry education, exploration, and guided practice.
              </p>
              <p className="ry-mkt-who-note">No prior brand placement experience required.</p>
            </aside>
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-cream" aria-labelledby="mkt-practice" id="guided-practice">
        <div className="ry-mkt-section ry-mkt-practice">
          <div className="ry-mkt-practice-copy">
            <h2 id="mkt-practice" className="ry-mkt-title">
              Learn the system. Then work inside it.
            </h2>
            <p className="ry-mkt-lede">
              Guided practice lets you apply what you’re learning through realistic commercial
              scenarios and structured decisions.
            </p>
            <p className="ry-mkt-pull ry-mkt-pull-spaced">
              Learn the commercial system. Then work inside guided scenarios.
            </p>
            <div className="ry-mkt-cta-row">
              <Link className="ry-mkt-btn ry-mkt-btn-primary" to="/the-program">
                See guided practice
              </Link>
            </div>
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
      </section>

      <section className="ry-mkt-band-dark" aria-labelledby="mkt-pricing">
        <div className="ry-mkt-section ry-mkt-pricing">
          <h2 id="mkt-pricing" className="ry-mkt-display">
            The Ryva Program
          </h2>
          <p className="ry-mkt-lede">
            Industry education. Guided practice. A closer look at the business behind the brands.
          </p>
          <div className="ry-mkt-cta-row">
            <Link className="ry-mkt-btn ry-mkt-btn-primary" to="/signup">
              Join The Ryva Program
            </Link>
            <Link className="ry-mkt-btn ry-mkt-btn-on-dark" to="/signup">
              View details
            </Link>
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-cream" aria-labelledby="mkt-faq" id="faq">
        <div className="ry-mkt-section ry-mkt-faq-layout">
          <div className="ry-mkt-faq-intro">
            <h2 id="mkt-faq" className="ry-mkt-title">
              Questions, answered.
            </h2>
            <div className="ry-mkt-cta-row">
              <Link className="ry-mkt-btn ry-mkt-btn-secondary" to="/faq">
                More questions
              </Link>
            </div>
          </div>
          <div className="ry-mkt-faq">
            {FAQS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export { MarketingHomePage as HomePage };
