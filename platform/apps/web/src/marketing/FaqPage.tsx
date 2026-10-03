import { useEffect } from "react";
import { Link } from "react-router-dom";

const FAQS: { q: string; a: string[] }[] = [
  {
    q: "What exactly is The Ryva Program?",
    a: [
      "The Ryva Program is a self-paced industry education and guided-practice experience focused on brand placement sales.",
      "It combines concise lessons, commercial context, exercises, and simulated scenarios to help you understand how brands, products, buyers, placements, orders, accounts, and commissions connect.",
    ],
  },
  {
    q: "Do I need brand placement experience?",
    a: [
      "No.",
      "The program is designed to be understandable even if you have never worked in brand placement before.",
      "It may also be useful for someone who already works around brands, retail, sales, merchandising, or related commercial environments and wants to understand brand placement more clearly.",
    ],
  },
  {
    q: "Is The Ryva Program a certification?",
    a: [
      "No.",
      "The Ryva Program is independent industry education and guided practice. It is not a professional certification, occupational license, or state-approved credential.",
    ],
  },
  {
    q: "Is this job training?",
    a: [
      "Ryva teaches you about the brand placement sales industry and gives you opportunities to work through guided commercial scenarios.",
      "It is not employer-specific job training and does not represent that completing the program qualifies someone for a particular job or occupation.",
    ],
  },
  {
    q: "Does Ryva guarantee employment?",
    a: [
      "No.",
      "Ryva does not guarantee employment, interviews, job placement, income, promotions, or career outcomes.",
    ],
  },
  {
    q: "What is guided practice?",
    a: [
      "Guided practice gives you a situation and asks you to do something with it.",
      "Instead of only reading about a buyer, product, placement, or order, you may be asked to evaluate information, notice relevant details, compare options, or choose a reasonable next step.",
      "The exercises are designed to deepen understanding rather than reproduce the internal processes of any particular employer.",
    ],
  },
  {
    q: "What is the final simulation?",
    a: [
      "The final simulation is a longer guided scenario at the end of the program.",
      "It connects several parts of the brand placement process so you can follow the commercial relationship across brand, product, buyer, placement, order, and account context.",
    ],
  },
  {
    q: "How long does the program take?",
    a: [
      "The Ryva Program is self-paced.",
      "A learner moving steadily through the material may complete it in approximately one to two weeks, depending on how much time they choose to spend with the exercises and simulations.",
    ],
  },
  {
    q: "Do I have to complete it within a certain number of days?",
    a: [
      "No.",
      "After you enroll, you can move through the learning modules at your own pace. Completing the program is what opens the operating platform, not a calendar deadline.",
    ],
  },
  {
    q: "Are there live classes?",
    a: [
      "No live attendance is required.",
      "The core Ryva Program is designed to be completed independently and on your own schedule.",
    ],
  },
  {
    q: "Will I receive grades?",
    a: [
      "The focus of Ryva is understanding, exploration, and application rather than traditional academic grading.",
      "Guided exercises may include feedback, explanations, comparisons, or suggested considerations depending on the activity.",
    ],
  },
  {
    q: "What industries does Ryva focus on?",
    a: [
      "The commercial principles explored in Ryva can appear across many product categories.",
      "That can include apparel, accessories, beauty, home and décor, gifts, lifestyle products, pet products, specialty goods, and other consumer-product categories sold through brand placement relationships.",
    ],
  },
  {
    q: "Is Ryva connected to a specific brand or retailer?",
    a: [
      "No.",
      "Program examples and simulations can use fictional or educational commercial scenarios unless otherwise clearly identified.",
      "Ryva is not presented as the internal training program of a particular retailer, brand, showroom, or employer.",
    ],
  },
  {
    q: "What happens after I finish?",
    a: [
      "Completing The Ryva Program, including the final guided simulation, unlocks the Ryva operating platform.",
      "The platform is included for 30 days at no charge. After that, it continues as a $20 monthly subscription if you choose to keep using it.",
    ],
  },
  {
    q: "What do I get when I pay $397?",
    a: [
      "The $397 enrollment is a one-time payment for The Ryva Program: the learning modules, guided exercises, practice scenarios, and final simulation inside Ryva.",
      "It does not open the operating platform by itself. Sign-in after purchase takes you into the learning environment until you complete the program.",
    ],
  },
  {
    q: "When do I get the Ryva platform?",
    a: [
      "After you complete The Ryva Program.",
      "Until then, signed-in access is the learning environment only. The representation, placement, outreach, and commercial tools stay closed.",
    ],
  },
  {
    q: "What does the platform cost after the program?",
    a: [
      "Thirty days at no charge after you complete the program, then $20 per month.",
      "The $397 Program payment is separate from the monthly platform subscription.",
    ],
  },
  {
    q: "Is Ryva a college or licensed school?",
    a: [
      "No.",
      "Ryva is an independent industry education platform. It is not presented as a college, university, licensed occupational school, or state-approved credentialing institution.",
    ],
  },
  {
    q: "Can I put Ryva on my résumé?",
    a: [
      "You can accurately state that you completed The Ryva Program or participated in independent brand placement industry education through Ryva.",
      "Avoid wording such as “Ryva Certified Brand Placement Representative,” “licensed,” “credentialed,” or anything implying that Ryva granted a professional qualification.",
    ],
  },
  {
    q: "Is the program refundable?",
    a: [
      "No. The Ryva Program is digital education delivered immediately after purchase, and all Program sales are final.",
      "By completing checkout you request immediate access and acknowledge that you will not receive a refund except where a refund is required by law.",
      "This policy is also stated on the enrollment page before you pay.",
    ],
  },
];

export function MarketingFaqPage() {
  useEffect(() => {
    document.title = "FAQ · Ryva";
  }, []);

  return (
    <div className="ry-mkt-faq-page">
      <section className="ry-mkt-band-cream" aria-labelledby="mkt-faq-hero">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-faq-hero">
          <h1 id="mkt-faq-hero" className="ry-mkt-display">
            Questions, answered.
          </h1>
          <p className="ry-mkt-lede">
            Everything you may want to know before stepping inside The Ryva Program.
          </p>
        </div>
      </section>

      <section className="ry-mkt-band-cream ry-mkt-faq-band" aria-labelledby="mkt-faq-list">
        <div className="ry-mkt-section ry-mkt-faq-layout">
          <div className="ry-mkt-faq-intro">
            <h2 id="mkt-faq-list" className="ry-mkt-title">
              Before you begin.
            </h2>
            <p className="ry-mkt-lede">
              Clear answers about the experience, what it is, and how to talk about it accurately.
            </p>
          </div>
          <div className="ry-mkt-faq">
            {FAQS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                {item.a.map((para, index) => (
                  <p key={`${item.q}-${index}`}>{para}</p>
                ))}
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="ry-mkt-band-dark ry-mkt-program-cta-band" aria-labelledby="mkt-faq-cta">
        <div className="ry-mkt-section ry-mkt-program-section ry-mkt-program-cta">
          <h2 id="mkt-faq-cta" className="ry-mkt-display">
            See brand placement differently.
          </h2>
          <p className="ry-mkt-lede">Understand the structure. Follow the relationships. Work through the decisions.</p>
          <div className="ry-mkt-cta-row">
            <Link className="ry-mkt-btn ry-mkt-btn-primary" to="/signup">
              Join The Ryva Program
            </Link>
            <Link className="ry-mkt-btn ry-mkt-btn-secondary ry-mkt-btn-on-dark" to="/curriculum">
              View Curriculum
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
