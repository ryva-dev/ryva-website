import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { APP_BASE, appPath, stripAppBase } from "../appBase.ts";

void describe("Ryva public marketing site", () => {
  void it("scopes marketing CSS under .ry-mkt and avoids platform shell selectors", () => {
    const css = readFileSync(new URL("./marketing.css", import.meta.url), "utf8");
    assert.match(css, /\.ry-mkt\s*\{/);
    assert.match(css, /\.ry-mkt-header/);
    assert.match(css, /\.ry-mkt-footer/);
    assert.match(css, /--mkt-wine/);
    assert.match(css, /--mkt-charcoal/);
    assert.doesNotMatch(css, /\.ry-shell[^-]/);
    assert.doesNotMatch(css, /\.ry-sidebar/);
    assert.doesNotMatch(css, /\.ry-workspace-topbar/);
  });

  void it("keeps marketing layout free of the authenticated application shell", () => {
    const layout = readFileSync(new URL("./MarketingLayout.tsx", import.meta.url), "utf8");
    const header = readFileSync(new URL("./MarketingHeader.tsx", import.meta.url), "utf8");
    assert.match(layout, /className="ry-mkt"/);
    assert.match(layout, /MarketingHeader/);
    assert.match(layout, /MarketingFooter/);
    assert.doesNotMatch(layout, /ApplicationShell|ProtectedLayout|ry-shell/);
    assert.match(header, /Open Ryva/);
    assert.match(header, /Join Ryva/);
    assert.match(header, /Sign In/);
    assert.match(header, /APP_BASE/);
  });

  void it("ships homepage sections and careful non-credentialing copy", () => {
    const home = readFileSync(new URL("./HomePage.tsx", import.meta.url), "utf8");
    const footer = readFileSync(new URL("./MarketingFooter.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./marketing.css", import.meta.url), "utf8");
    assert.match(home, /brand placement/);
    assert.match(home, /ry-mkt-display-accent/);
    assert.match(home, /Explore The Program/);
    assert.match(home, /See How It Works/);
    assert.match(home, /Understand/);
    assert.match(home, /See how the pieces connect/);
    assert.match(home, /What’s inside The Ryva Program/);
    assert.match(home, /What you’ll explore/);
    assert.match(home, /business behind the brands/);
    assert.match(home, /Learn the system\. Then work inside it/);
    assert.match(home, /Join The Ryva Program/);
    assert.match(home, /to="\/signup"/);
    assert.doesNotMatch(home, /to="\/pricing"/);
    assert.match(home, /Is this a certification\?/);
    assert.match(home, /does not provide professional licensure/);
    assert.match(home, /Industry education, exploration, and guided practice/);
    assert.match(home, /ry-mkt-flow-sequence/);
    assert.match(home, /ry-mkt-value-list/);
    assert.doesNotMatch(home, /ry-mkt-flow-panel|ry-mkt-pricing-frame|ry-mkt-curriculum-panel|ry-mkt-who-panel/);
    assert.doesNotMatch(home, /Independent industry education — not a certification/);
    assert.doesNotMatch(home, /guaranteed (job|employment|career)/i);
    assert.doesNotMatch(home, /The career explorer|The commercially curious|The practice-minded/);
    assert.doesNotMatch(home, /tuition/i);
    assert.match(home, /industry education/i);
    assert.match(home, /guided practice/i);
    assert.match(footer, /independent educational and software platform/);
    assert.match(css, /\.ry-mkt-wordmark:hover\s*\{\s*color:\s*var\(--mkt-wine\)/);
  });

  void it("describes the public site as brand placement, not wholesale sales", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    assert.match(html, /brand placement/);
    assert.doesNotMatch(html, /wholesale/i);
    assert.doesNotMatch(html, /—/);
  });

  void it("prefixes authenticated platform paths with /app", () => {
    assert.equal(APP_BASE, "/app");
    assert.equal(appPath("/"), "/app");
    assert.equal(appPath("/products"), "/app/products");
    assert.equal(stripAppBase("/app"), "/");
    assert.equal(stripAppBase("/app/settings"), "/settings");
  });

  void it("ships a dedicated program page beyond the homepage shell", () => {
    const program = readFileSync(new URL("./ProgramPage.tsx", import.meta.url), "utf8");
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    assert.match(program, /A closer look at/);
    assert.match(program, /brand placement/);
    assert.match(program, /Learn it\. See it\. Work through it/);
    assert.match(program, /More than a series of lessons/);
    assert.match(program, /Follow the product beyond the brand/);
    assert.match(program, /Understanding is different when you have to make the decision/);
    assert.match(program, /Bring the entire system together/);
    assert.match(program, /Designed to fit into real life/);
    assert.match(program, /A note about The Ryva Program/);
    assert.match(program, /See brand placement differently/);
    assert.match(program, /not a professional certification/);
    assert.match(program, /Join The Ryva Program/);
    assert.doesNotMatch(program, /—/);
    assert.doesNotMatch(program, /prove mastery|demonstrate competency|certify/i);
    assert.match(app, /MarketingProgramPage/);
  });

  void it("ships dedicated how-it-works, curriculum, and FAQ pages", () => {
    const how = readFileSync(new URL("./HowItWorksPage.tsx", import.meta.url), "utf8");
    const curriculum = readFileSync(new URL("./CurriculumPage.tsx", import.meta.url), "utf8");
    const faq = readFileSync(new URL("./FaqPage.tsx", import.meta.url), "utf8");
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    assert.match(how, /Learn the system/);
    assert.match(how, /Brand placement can feel invisible/);
    assert.match(how, /Start with the world/);
    assert.match(how, /Bring the entire commercial journey together/);
    assert.match(how, /Explore The Ryva Program/);
    assert.doesNotMatch(how, /wholesale/i);
    assert.doesNotMatch(how, /—/);
    assert.match(curriculum, /Learn the business behind the brands/);
    assert.match(curriculum, /Inside Brand Placement/);
    assert.match(curriculum, /commission structures/);
    assert.match(curriculum, /What would you pay attention to/);
    assert.doesNotMatch(curriculum, /wholesale/i);
    assert.doesNotMatch(curriculum, /—/);
    assert.match(faq, /What exactly is The Ryva Program/);
    assert.match(faq, /Does Ryva guarantee employment/);
    assert.match(faq, /What industries does Ryva focus on/);
    assert.match(faq, /Is the program refundable/);
    assert.match(faq, /all Program sales are final/);
    assert.match(faq, /What do I get when I pay \$397/);
    assert.match(faq, /When do I get the Ryva platform/);
    assert.match(faq, /\$20 monthly subscription/);
    assert.doesNotMatch(faq, /wholesale/i);
    assert.doesNotMatch(faq, /—/);
    assert.match(app, /MarketingHowItWorksPage/);
    assert.match(app, /MarketingCurriculumPage/);
    assert.match(app, /MarketingFaqPage/);
  });

  void it("wires App routes for marketing and /app platform mount", () => {
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    assert.match(app, /MarketingLayout/);
    assert.match(app, /MarketingHomePage/);
    assert.match(app, /MarketingProgramPage/);
    assert.match(app, /path="\/app"/);
    assert.match(app, /path="\/login"/);
    assert.match(app, /path="signup"/);
    assert.match(app, /path="checkout"/);
    assert.match(app, /path="pricing"/);
    assert.match(app, /Navigate to="\/signup"/);
    assert.match(app, /the-program/);
    assert.match(app, /path="terms"/);
    assert.match(app, /path="privacy"/);
    assert.match(app, /path="refund-policy"/);
    assert.match(app, /path="disclaimer"/);
    assert.doesNotMatch(app, /guided-practice/);
  });

  void it("publishes the finalized legal package and disclosures", () => {
    const legal = readFileSync(new URL("./LegalPages.tsx", import.meta.url), "utf8");
    const footer = readFileSync(new URL("./MarketingFooter.tsx", import.meta.url), "utf8");
    const signup = readFileSync(new URL("./SignupPage.tsx", import.meta.url), "utf8");
    const account = readFileSync(new URL("./CreateAccountPage.tsx", import.meta.url), "utf8");
    assert.match(legal, /October 2, 2026/);
    assert.match(legal, /Ryva Forge, LLC/);
    assert.match(legal, /2924 Espy Ave/);
    assert.match(legal, /support@ryvaforge\.com/);
    assert.match(legal, /final and non-refundable except where required by applicable law/);
    assert.match(legal, /Educational & Commercial Disclaimer/);
    assert.match(footer, /\/refund-policy/);
    assert.match(footer, /\/disclaimer/);
    assert.doesNotMatch(footer, /preventDefault/);
    assert.match(signup, /\$397 one-time purchase/);
    assert.match(signup, /I have read and agree to the/);
    assert.match(signup, /does not guarantee employment, income, brand representation, retailer placement, sales, orders, or commissions/);
    assert.match(account, /I agree to Ryva’s/);
    assert.equal((account.match(/type="checkbox"/g) ?? []).length, 1);
  });

  void it("ships a full enrollment page without developer placeholder copy", () => {
    const enroll = readFileSync(new URL("./SignupPage.tsx", import.meta.url), "utf8");
    const offer = readFileSync(new URL("./programOffer.ts", import.meta.url), "utf8");
    assert.match(enroll, /Step inside The Ryva Program/);
    assert.match(enroll, /Join The Ryva Program/);
    assert.match(enroll, /formatProgramPrice/);
    assert.match(enroll, /PROGRAM_CHECKOUT_PATH/);
    assert.match(enroll, /brand placement/);
    assert.doesNotMatch(enroll, /Enrollment will live here/);
    assert.doesNotMatch(enroll, /not open in this build/);
    assert.doesNotMatch(enroll, /wholesale/i);
    assert.doesNotMatch(enroll, /—/);
    assert.match(offer, /PROGRAM_PRICE_USD = 397/);
    assert.match(offer, /PLATFORM_MONTHLY_USD = 20/);
    assert.match(offer, /PLATFORM_TRIAL_DAYS = 30/);
    assert.match(offer, /PROGRAM_REFUND_STATEMENT/);
    assert.match(offer, /All Program sales are final/);
    assert.match(enroll, /PROGRAM_REFUND_STATEMENT/);
    assert.match(enroll, /\/api\/program\/checkout/);
    assert.doesNotMatch(offer, /VITE_RYVA_CHECKOUT_URL/);
  });
});
