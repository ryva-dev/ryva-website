import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiProblem } from "../api";
import { APP_BASE } from "../appBase";
import { useAuth } from "../auth";
import {
  PLATFORM_ACCESS_INCLUDE,
  PLATFORM_ACCESS_NOTE,
  PROGRAM_CHECKOUT_PATH,
  PROGRAM_OFFER_INCLUDES,
  PROGRAM_REFUND_STATEMENT,
  formatProgramPrice
} from "./programOffer";

const INCLUDES = [
  {
    title: "Industry lessons",
    body: "Focused explanations of the structures, terminology, relationships, and workflows behind brand placement.",
  },
  {
    title: "Guided exercises",
    body: "Short activities that help you interpret information, compare situations, and apply what you are learning.",
  },
  {
    title: "Ryva Guided Practice",
    body: "Step into structured commercial scenarios inspired by brand placement workflows and make decisions in context.",
  },
  {
    title: "Final Simulation",
    body: "Bring the program together through a longer scenario connecting brand, product, buyer, placement, order, and account context.",
  },
] as const;

const PROGRESSION = [
  "Learn the language",
  "See the relationships",
  "Work through the decisions",
  "Complete the final simulation",
] as const;

const WHO = [
  "Curious about how products reach retailers",
  "Interested in the business side of brands",
  "Exploring brand placement sales",
  "Prefer learning through context and practice",
  "Want to understand the commercial process more clearly",
] as const;

const KNOW = [
  {
    title: "Self-paced",
    body: "Move through the program on your own schedule.",
  },
  {
    title: "No prior brand placement experience required",
    body: "The program begins with the industry foundations.",
  },
  {
    title: "Independent industry education",
    body: "The Ryva Program is designed for education, exploration, and guided practice.",
  },
  {
    title: "Not a professional credential",
    body: "Completion does not represent professional licensure, certification, job placement, or guaranteed employment.",
  },
] as const;

function OfferIncludes() {
  return (
    <ul className="ry-mkt-enroll-summary-list">
      {PROGRAM_OFFER_INCLUDES.map((item) => (
        <li key={item}>
          {item}
          {item === PLATFORM_ACCESS_INCLUDE ? (
            <sup className="ry-mkt-enroll-star" aria-hidden="true">
              *
            </sup>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CheckoutDisclosure() {
  return <div className="ry-mkt-checkout-disclosure">
    <strong>$397 one-time purchase</strong>
    <p>Includes access to The Ryva Program and the benefits described on this page.</p>
    <p>Program purchases are final and non-refundable except where required by law.</p>
    <p>Completion of The Ryva Program does not constitute professional certification and does not guarantee employment, income, brand representation, retailer placement, sales, orders, or commissions.</p>
  </div>;
}

function JoinCta({ className }: { className: string }) {
  const { session, loading } = useAuth();
  if (!loading && session) {
    return (
      <Link className={className} to={APP_BASE}>
        Open Ryva
      </Link>
    );
  }
  return (
    <Link className={className} to={PROGRAM_CHECKOUT_PATH}>
      Join The Ryva Program
    </Link>
  );
}

export function SignupPage() {
  useEffect(() => {
    document.title = "Join The Ryva Program · Ryva";
  }, []);

  const price = formatProgramPrice();

  return (
    <div className="ry-mkt-enroll">
      <section className="ry-mkt-band-cream" aria-labelledby="mkt-enroll-hero">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-enroll-hero">
          <h1 id="mkt-enroll-hero" className="ry-mkt-display">
            Step inside The Ryva Program.
          </h1>
          <p className="ry-mkt-lede">
            Explore the commercial world behind brand placement through industry education, guided
            exercises, realistic practice scenarios, and a final simulation.
          </p>
          <p className="ry-mkt-lede">No previous brand placement experience is required.</p>
          <div className="ry-mkt-cta-row">
            <JoinCta className="ry-mkt-btn ry-mkt-btn-primary" />
          </div>
          <p className="ry-mkt-enroll-signin">
            Already have access? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </section>

      <section className="ry-mkt-band-deep" aria-labelledby="mkt-enroll-offer">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-enroll-offer">
          <div className="ry-mkt-enroll-offer-copy">
            <h2 id="mkt-enroll-offer" className="ry-mkt-title">
              One program.
              <br />
              A closer look at brand placement.
            </h2>
            <p className="ry-mkt-lede">
              The Ryva Program is a self-paced learning experience designed to help you understand
              how brand placement sales works, from brands and products through buyers, placements,
              orders, accounts, and commissions.
            </p>
          </div>
          <div className="ry-mkt-enroll-summary-wrap">
            <aside className="ry-mkt-enroll-summary" aria-label="Program offer">
              <p className="ry-mkt-enroll-summary-name">The Ryva Program</p>
              <p className="ry-mkt-enroll-price">{price}</p>
              <OfferIncludes />
              <JoinCta className="ry-mkt-btn ry-mkt-btn-primary ry-mkt-enroll-summary-cta" />
              <p className="ry-mkt-enroll-secure">Secure checkout · One-time payment</p>
              <p className="ry-mkt-enroll-refund">{PROGRAM_REFUND_STATEMENT}</p>
              <CheckoutDisclosure />
            </aside>
            <p className="ry-mkt-enroll-footnote">* {PLATFORM_ACCESS_NOTE}</p>
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-cream" aria-labelledby="mkt-enroll-includes">
        <div className="ry-mkt-section ry-mkt-program-section">
          <div className="ry-mkt-program-intro">
            <h2 id="mkt-enroll-includes" className="ry-mkt-title">
              Everything works together.
            </h2>
          </div>
          <div className="ry-mkt-program-inside-list">
            {INCLUDES.map((item) => (
              <article key={item.title} className="ry-mkt-program-inside-item">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-dark ry-mkt-program-sim-band" aria-labelledby="mkt-enroll-move">
        <div className="ry-mkt-section ry-mkt-program-section">
          <h2 id="mkt-enroll-move" className="ry-mkt-title">
            Learn. Explore. Practice.
          </h2>
          <ol className="ry-mkt-flow-sequence ry-mkt-flow-sequence-dark ry-mkt-enroll-progress" aria-label="Program progression">
            {PROGRESSION.map((item) => (
              <li key={item}>
                <span className="ry-mkt-flow-label">{item}</span>
              </li>
            ))}
          </ol>
          <p className="ry-mkt-lede">
            Move through The Ryva Program at your own pace. A learner working steadily through the
            material may complete it in approximately one to two weeks, although there is no
            requirement to finish on that schedule.
          </p>
        </div>
      </section>

      <section className="ry-mkt-band-cream" aria-labelledby="mkt-enroll-who">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-enroll-who">
          <div>
            <h2 id="mkt-enroll-who" className="ry-mkt-title">
              You don’t need to already work in brand placement.
            </h2>
            <p className="ry-mkt-lede">
              Ryva was created for people curious about the business behind brands, whether you are
              exploring brand placement for the first time or already interested in retail, sales,
              products, merchandising, or commercial relationships.
            </p>
          </div>
          <ul className="ry-mkt-enroll-who-list">
            {WHO.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ry-mkt-band-taupe" aria-labelledby="mkt-enroll-know">
        <div className="ry-mkt-section ry-mkt-program-section">
          <div className="ry-mkt-program-intro">
            <h2 id="mkt-enroll-know" className="ry-mkt-title">
              Clear from the beginning.
            </h2>
          </div>
          <div className="ry-mkt-program-inside-list">
            {KNOW.map((item) => (
              <article key={item.title} className="ry-mkt-program-inside-item">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-dark ry-mkt-program-cta-band" aria-labelledby="mkt-enroll-cta">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-program-cta">
          <h2 id="mkt-enroll-cta" className="ry-mkt-display">
            See the business behind the brands.
          </h2>
          <p className="ry-mkt-lede">Industry education. Commercial context. Guided practice.</p>
          <p className="ry-mkt-enroll-cta-price">
            {price} · One-time payment
          </p>
          <div className="ry-mkt-cta-row">
            <JoinCta className="ry-mkt-btn ry-mkt-btn-primary" />
            <Link className="ry-mkt-btn ry-mkt-btn-secondary ry-mkt-btn-on-dark" to="/curriculum">
              View Curriculum
            </Link>
          </div>
          <p className="ry-mkt-program-cta-foot">
            Already enrolled? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </div>
  );
}

export function ProgramCheckoutPage() {
  const auth = useAuth();
  const { session, loading, refresh } = auth;
  const [searchParams] = useSearchParams();
  const [working, setWorking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [checkoutConsentAccepted, setCheckoutConsentAccepted] = useState(false);
  const [legalVersions, setLegalVersions] = useState<{
    terms: string;
    refundPolicy: string;
    disclaimer: string;
  } | null>(null);
  const checkoutState = searchParams.get("checkout");

  useEffect(() => {
    document.title = "Checkout · Ryva";
    void api<{ legalDocuments: {
      terms: { version: string };
      refundPolicy: { version: string };
      disclaimer: { version: string };
    } }>("/api/identity/context")
      .then((result) => setLegalVersions({
        terms: result.legalDocuments.terms.version,
        refundPolicy: result.legalDocuments.refundPolicy.version,
        disclaimer: result.legalDocuments.disclaimer.version
      }))
      .catch(() => setError("The current legal documents could not be loaded. Checkout is temporarily unavailable."));
  }, []);

  useEffect(() => {
    if (checkoutState !== "success") return;
    let canceled = false;
    let attempts = 0;
    setConfirming(true);
    const check = async () => {
      attempts += 1;
      const current = await refresh();
      if (canceled || current?.access.canAccessProgram) {
        setConfirming(false);
      } else if (attempts < 10) {
        window.setTimeout(() => { void check(); }, 1500);
      } else {
        setConfirming(false);
        setError("Payment confirmation is taking longer than expected. You can check again safely; access is granted only after Stripe confirms payment.");
      }
    };
    void check();
    return () => { canceled = true; };
  }, [checkoutState, refresh]);

  async function openCheckout() {
    if (!legalVersions || !checkoutConsentAccepted) {
      setError("Review and accept the required checkout disclosure before continuing.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const checkout = await api<{ url: string }>("/api/program/checkout", {
        method: "POST",
        body: {
          termsAccepted: true,
          refundPolicyAccepted: true,
          nonRefundableAcknowledged: true,
          commercialDisclaimerAcknowledged: true,
          termsVersion: legalVersions.terms,
          refundPolicyVersion: legalVersions.refundPolicy,
          disclaimerVersion: legalVersions.disclaimer
        }
      });
      window.location.assign(checkout.url);
    } catch (caught) {
      setError(caught instanceof ApiProblem ? caught.message : "Secure checkout could not be opened.");
      setWorking(false);
    }
  }

  async function checkAccess() {
    setConfirming(true);
    setError("");
    const current = await refresh();
    setConfirming(false);
    if (!current?.access.canAccessProgram) {
      setError("Stripe has not confirmed this payment yet. Check again shortly; you will not be charged again.");
    }
  }

  const price = formatProgramPrice();

  return (
    <div className="ry-mkt-enroll">
      <section className="ry-mkt-band-cream" aria-labelledby="mkt-checkout">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-enroll-offer">
          <div className="ry-mkt-enroll-offer-copy">
            <h1 id="mkt-checkout" className="ry-mkt-display">
              Step inside The Ryva Program.
            </h1>
            <p className="ry-mkt-lede">
              Continue to secure checkout to complete your one-time enrollment.
            </p>
            {checkoutState === "canceled" ? <p className="ry-mkt-identity-error" role="status">Checkout was canceled. Your account was not charged and Program access was not granted.</p> : null}
            {checkoutState === "success" && !session?.access.canAccessProgram ? <p className="ry-mkt-enroll-signin" role="status">Payment was received. We’re securely confirming your Program access now.</p> : null}
            {error ? <p className="ry-mkt-identity-error" role="alert">{error}</p> : null}
            {!loading && !session ? <p className="ry-mkt-enroll-signin">Create an account or sign in before checkout so your purchase can be connected securely.</p> : null}
          </div>
          <div className="ry-mkt-enroll-summary-wrap">
            <aside className="ry-mkt-enroll-summary" aria-label="Program offer">
              <p className="ry-mkt-enroll-summary-name">The Ryva Program</p>
              <p className="ry-mkt-enroll-price">{price}</p>
              <OfferIncludes />
              {!loading && session?.access.canAccessProgram ? (
                <Link className="ry-mkt-btn ry-mkt-btn-primary ry-mkt-enroll-summary-cta" to={`${APP_BASE}/program`}>
                  Open The Ryva Program
                </Link>
              ) : !loading && session ? (
                <>
                  {checkoutState !== "success" ? <div className="ry-mkt-checkout-consents">
                    <label><input type="checkbox" checked={checkoutConsentAccepted} onChange={(event) => setCheckoutConsentAccepted(event.target.checked)} /> <span>I have read and agree to the <Link to="/terms" target="_blank" rel="noreferrer">Terms of Service</Link> and <Link to="/refund-policy" target="_blank" rel="noreferrer">Refund &amp; Cancellation Policy</Link>, and I understand that The Ryva Program is a non-refundable digital purchase except where required by law and does not guarantee employment, income, brand representation, retailer placement, sales, orders, or commissions.</span></label>
                    <p id="ry-program-consent-help">Consent is required before secure checkout can open.</p>
                  </div> : null}
                  <button
                    type="button"
                    disabled={working || confirming || (checkoutState !== "success" && (!legalVersions || !checkoutConsentAccepted))}
                    aria-describedby={checkoutState !== "success" ? "ry-program-consent-help" : undefined}
                    className="ry-mkt-btn ry-mkt-btn-primary ry-mkt-enroll-summary-cta"
                    onClick={() => { void (checkoutState === "success" ? checkAccess() : openCheckout()); }}
                  >
                    {working ? "Opening secure checkout…" : confirming ? "Confirming access…" : checkoutState === "success" ? "Check Program access" : "Continue to secure checkout"}
                  </button>
                </>
              ) : (
                <div className="ry-mkt-cta-row">
                  <Link className="ry-mkt-btn ry-mkt-btn-primary" to="/create-account">Create account</Link>
                  <Link className="ry-mkt-btn ry-mkt-btn-secondary" to="/login?next=/checkout">Sign in</Link>
                </div>
              )}
              <p className="ry-mkt-enroll-secure">Secure checkout · One-time payment</p>
              <p className="ry-mkt-enroll-refund">{PROGRAM_REFUND_STATEMENT}</p>
              <CheckoutDisclosure />
            </aside>
            <p className="ry-mkt-enroll-footnote">* {PLATFORM_ACCESS_NOTE}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
