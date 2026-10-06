export const PUBLIC_ORIGIN = "https://www.ryvaforge.com";
export const HOME_TITLE = "Ryva | Brand Placement & Wholesale Industry Education";
export const HOME_DESCRIPTION = "Learn how brand placement, wholesale sales, retail buyers, and brand-to-retailer commercial relationships work through The Ryva Program.";

export type PublicSeoRoute = {
  title: string;
  description: string;
};

export const PUBLIC_SEO_ROUTES: Record<string, PublicSeoRoute> = {
  "/": {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION
  },
  "/the-program": {
    title: "The Ryva Program | Brand Placement Education",
    description: "Explore independent education and guided practice covering brand placement, wholesale fundamentals, retail buyers, orders, accounts, and commissions."
  },
  "/how-it-works": {
    title: "How The Ryva Program Works | Ryva",
    description: "See how Ryva combines concise industry lessons, commercial context, guided exercises, and realistic brand placement scenarios."
  },
  "/curriculum": {
    title: "Brand Placement Curriculum | Ryva",
    description: "Review eight modules covering products, assortment, retail buyers, placement strategy, wholesale orders, account development, and commissions."
  },
  "/faq": {
    title: "The Ryva Program FAQ | Ryva",
    description: "Answers about The Ryva Program, guided practice, access, completion, and its independent educational purpose."
  },
  "/terms": {
    title: "Terms of Service | Ryva",
    description: "Terms governing access to and use of the Ryva website, The Ryva Program, Ryva Pro, and related services."
  },
  "/privacy": {
    title: "Privacy Policy | Ryva",
    description: "How Ryva Forge, LLC collects, uses, discloses, and protects personal information."
  },
  "/refund-policy": {
    title: "Refund & Cancellation Policy | Ryva",
    description: "The refund and cancellation terms for The Ryva Program and Ryva Pro."
  },
  "/disclaimer": {
    title: "Educational & Commercial Disclaimer | Ryva",
    description: "Important educational, commercial, and outcomes disclaimers for The Ryva Program and Ryva services."
  }
};
