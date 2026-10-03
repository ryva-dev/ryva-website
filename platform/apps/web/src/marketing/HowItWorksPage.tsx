import { useEffect } from "react";
import { Link } from "react-router-dom";
import heroGlobe from "./assets/hero-globe.png";

const STEPS = [
  {
    title: "Learn",
    body: "Build familiarity with the language, structure, roles, and commercial rhythms behind brand placement sales.",
  },
  {
    title: "Explore",
    body: "See how the pieces influence one another, from the product a brand wants to sell to the buyer deciding whether it belongs in their assortment.",
  },
  {
    title: "Practice",
    body: "Work through guided decisions, observations, and scenarios inspired by real brand placement workflows.",
  },
] as const;

const PACE = [
  "No live attendance schedule.",
  "No previous brand placement experience required.",
] as const;

export function MarketingHowItWorksPage() {
  useEffect(() => {
    document.title = "How It Works · Ryva";
  }, []);

  return (
    <div className="ry-mkt-works">
      <section className="ry-mkt-band-cream ry-mkt-program-hero-band" aria-labelledby="mkt-works-hero">
        <div className="ry-mkt-program-hero ry-mkt-program-hero-text ry-mkt-program-hero-center ry-mkt-reveal">
          <div className="ry-mkt-program-hero-copy">
            <h1 id="mkt-works-hero" className="ry-mkt-display">
              <span className="ry-mkt-display-line">Learn the system.</span>
              <span className="ry-mkt-display-line">See it in context.</span>
              <span className="ry-mkt-display-accent">Work through it.</span>
            </h1>
            <p className="ry-mkt-lede">
              Brand placement can feel invisible from the outside.
            </p>
            <p className="ry-mkt-lede">
              The Ryva Program makes the commercial process easier to understand by showing how
              brands, products, buyers, placements, orders, accounts, and commissions connect.
            </p>
            <p className="ry-mkt-lede">
              Then it gives you opportunities to work through those relationships yourself.
            </p>
            <div className="ry-mkt-cta-row">
              <Link className="ry-mkt-btn ry-mkt-btn-primary" to="/the-program">
                Explore The Ryva Program
              </Link>
              <Link className="ry-mkt-btn ry-mkt-btn-secondary" to="/curriculum">
                View Curriculum
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-deep" aria-labelledby="mkt-works-experience">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-program-experience">
          <div className="ry-mkt-program-experience-head">
            <h2 id="mkt-works-experience" className="ry-mkt-title">
              Start with the world.
              <br />
              Then step inside it.
            </h2>
            <p className="ry-mkt-lede">You’ll move through the program in a deliberate progression.</p>
          </div>
          <div className="ry-mkt-program-experience-stage">
            <div className="ry-mkt-program-columns">
              {STEPS.map((item) => (
                <article key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
          <p className="ry-mkt-pull ry-mkt-pull-spaced ry-mkt-pull-line">
            Understanding comes first. Context makes it useful.{" "}
            <span className="ry-mkt-pull-mark">Practice makes it stick.</span>
          </p>
        </div>
      </section>

      <section className="ry-mkt-band-cream" aria-labelledby="mkt-works-context">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-works-context">
          <div className="ry-mkt-works-context-copy">
            <h2 id="mkt-works-context" className="ry-mkt-title">
              Brand placement is more than making a sale.
            </h2>
            <p className="ry-mkt-lede">
              A product may begin with a brand, but getting it into the right retail environment
              involves positioning, assortment, buyer relationships, timing, communication,
              ordering, follow-through, and continued account development.
            </p>
            <p className="ry-mkt-lede">Ryva helps you see that larger commercial picture.</p>
            <p className="ry-mkt-pull ry-mkt-pull-spaced">
              The goal is not memorization. It is learning to see how the business moves.
            </p>
          </div>
          <div className="ry-mkt-works-context-visual" aria-hidden="true">
            <div className="ry-mkt-globe-frame">
              <img className="ry-mkt-globe-img" src={heroGlobe} alt="" decoding="async" />
            </div>
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-deep" aria-labelledby="mkt-works-practice">
        <div className="ry-mkt-section ry-mkt-program-section">
          <div className="ry-mkt-program-intro">
            <h2 id="mkt-works-practice" className="ry-mkt-title">
              You won’t only read about the decisions.
            </h2>
            <p className="ry-mkt-lede">
              You may be asked to review a product assortment, consider the fit between a brand and
              retailer, prepare for a buyer interaction, choose a next step, interpret an order, or
              follow an account as the relationship develops.
            </p>
            <p className="ry-mkt-lede">
              There is not always one magical “correct” commercial answer.
            </p>
            <p className="ry-mkt-lede">
              The point is to notice what matters, understand the tradeoffs, and make a reasoned
              decision from the information available.
            </p>
            <div className="ry-mkt-cta-row">
              <Link className="ry-mkt-btn ry-mkt-btn-primary" to="/the-program">
                Explore The Ryva Program
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-wine" aria-labelledby="mkt-works-sim">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-works-sim">
          <h2 id="mkt-works-sim" className="ry-mkt-display">
            Bring the entire commercial journey together.
          </h2>
          <p className="ry-mkt-lede">
            Near the end of The Ryva Program, you’ll work through a longer scenario connecting the
            concepts you explored throughout the experience.
          </p>
          <p className="ry-mkt-lede">
            Follow a brand and product through buyer context, placement considerations,
            communication, an order, and what happens next.
          </p>
          <p className="ry-mkt-pull ry-mkt-pull-spaced">
            See the relationship, not just the transaction.
          </p>
        </div>
      </section>

      <section className="ry-mkt-band-cream" aria-labelledby="mkt-works-pace">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-works-pace">
          <div>
            <h2 id="mkt-works-pace" className="ry-mkt-title">
              Designed to fit into real life.
            </h2>
            <p className="ry-mkt-lede">Ryva is self-paced.</p>
            <p className="ry-mkt-lede">
              Someone moving steadily through the lessons, exercises, and scenarios may complete the
              program in approximately one to two weeks, while others may choose to take longer.
            </p>
            <ul className="ry-mkt-works-facts" aria-label="Program pace">
              {PACE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="ry-mkt-cta-row">
              <Link className="ry-mkt-btn ry-mkt-btn-primary" to="/curriculum">
                View Curriculum
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
