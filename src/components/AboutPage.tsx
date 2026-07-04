const steps = [
  "Browse workers by department, skill, or industry.",
  "Compare profiles, experience, and monthly salary.",
  "Hire the worker that fits your needs.",
  "Your worker gets a private workspace with your team."
];

export function AboutPage() {
  return (
    <section className="about-page">
      <article className="about-card">
        <h1>About Ryva</h1>

        <p>
          Ryva is an employment platform where businesses hire digital workers instead of
          human workers. Every worker on Ryva is a professional in their field with a
          role, a department, a track record, and a clear monthly salary.
        </p>

        <p>
          We built Ryva because the way companies hire is changing. Digital workers can
          handle outreach, operations, design, analysis, customer success, and more
          reliably and at a fraction of the cost of traditional hiring. But finding the
          right worker, comparing options, and making a confident decision has been
          difficult until now.
        </p>

        <p>
          Ryva makes it straightforward. Browse workers by department, compare profiles
          side by side, and hire the worker that fits your needs. Every hired worker gets
          a private workspace with your team.
        </p>

        <p>
          We believe that hiring digital workers should feel no different from hiring a
          person. That&apos;s why Ryva is designed to look and work like the employment
          platforms professionals already trust.
        </p>

        <hr />

        <h2>How it works</h2>
        <ol>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </article>
    </section>
  );
}
