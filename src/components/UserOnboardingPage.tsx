import { useMemo, useState, type FormEvent } from "react";

type UserOnboardingPageProps = {
  error: string;
  initialName: string;
  loading: boolean;
  onSubmit: (input: { brandName: string; name: string; whatYouDo: string }) => Promise<void>;
};

const whatYouDoSuggestions = [
  "We run an ecommerce brand selling premium physical products.",
  "We provide a service business and need sharper operations and marketing.",
  "We build a creator-led brand and need cleaner execution across content and sales."
];

export function UserOnboardingPage({ error, initialName, loading, onSubmit }: UserOnboardingPageProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [brandName, setBrandName] = useState("");
  const [whatYouDo, setWhatYouDo] = useState("");

  const canContinue = useMemo(() => {
    if (step === 0) return name.trim().length >= 2;
    if (step === 1) return brandName.trim().length >= 2;
    return whatYouDo.trim().length >= 8;
  }, [brandName, name, step, whatYouDo]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }

    await onSubmit({
      brandName: brandName.trim(),
      name: name.trim(),
      whatYouDo: whatYouDo.trim()
    });
  }

  return (
    <main className="user-onboarding-page">
      <section className="user-onboarding-shell">
        <div className="user-onboarding-intro">
          <p className="auth-section-label">New account setup</p>
          <h1>Set up your office before you hire.</h1>
          <p>
            This gives Ryva the basics it needs to route work, prefill office context, and make the first worker
            onboarding useful instead of generic.
          </p>
        </div>

        <div className="user-onboarding-steps r-seg" aria-label="Onboarding progress">
          {["Your name", "Brand", "What you do"].map((label, index) => (
            <button
              className={index === step ? "r-seg-option is-active" : "r-seg-option"}
              key={label}
              onClick={() => {
                if (index <= step) {
                  setStep(index);
                }
              }}
              type="button"
            >
              <span>{index + 1}</span>
              {label}
            </button>
          ))}
        </div>

        <form className="user-onboarding-card" onSubmit={handleSubmit}>
          {step === 0 ? (
            <label className="ro-field">
              <span>Your name</span>
              <input
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Full name"
                type="text"
                value={name}
              />
              <small>This is how your office and future workers will address you.</small>
            </label>
          ) : null}

          {step === 1 ? (
            <label className="ro-field">
              <span>Business or brand name</span>
              <input
                autoComplete="organization"
                onChange={(event) => setBrandName(event.target.value)}
                placeholder="Studio name, company name, or brand name"
                type="text"
                value={brandName}
              />
              <small>This becomes the operating context around your team.</small>
            </label>
          ) : null}

          {step === 2 ? (
            <div className="user-onboarding-step">
              <label className="ro-field">
                <span>What do you do?</span>
                <textarea
                  onChange={(event) => setWhatYouDo(event.target.value)}
                  placeholder="One clear line describing the business, offer, or audience."
                  rows={4}
                  value={whatYouDo}
                />
                <small>Keep it short. This seeds your office brand context.</small>
              </label>

              <div className="r-seg user-onboarding-suggestions" aria-label="Quick examples">
                {whatYouDoSuggestions.map((option) => (
                  <button
                    className={whatYouDo === option ? "r-seg-option is-active" : "r-seg-option"}
                    key={option}
                    onClick={() => setWhatYouDo(option)}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <p className="form-error">{error}</p> : null}

          <div className="user-onboarding-actions">
            {step > 0 ? (
              <button className="button button-secondary" onClick={() => setStep((current) => current - 1)} type="button">
                Back
              </button>
            ) : (
              <span />
            )}
            <button className="button button-primary r-btn" disabled={!canContinue || loading} type="submit">
              {loading ? "Saving..." : step === 2 ? "Enter marketplace" : "Continue"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
