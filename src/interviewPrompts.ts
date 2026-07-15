import type { Worker } from "./types";

export type InterviewMessage = {
  id: string;
  speaker: "manager" | "worker";
  text: string;
};

export type InterviewGuide = {
  canHelpWith: string[];
  fitNotes: string[];
  needsFromYou: string[];
  suggestedQuestions: string[];
  summary: string;
};

function baseSuggestedQuestions(worker: Worker) {
  return [
    `How would you help me as my ${worker.title}?`,
    "What would your first week look like?",
    "What do you need from me to do this well?",
    "How often would we meet?",
    "What makes you different from another worker?"
  ];
}

function genericReply(worker: Worker, question: string) {
  const lower = question.toLowerCase();

  if (lower.includes("first week")) {
    return `In my first week, I would learn your priorities, review current materials, set up a clean working rhythm, and identify the first work batch that should move immediately. I prefer to get specific fast so the office sees progress early.`;
  }

  if (lower.includes("need from me")) {
    return `I need clear goals, examples of what good work looks like, and your approval rules. If I know where you want to move quickly and where you want tighter control, I can operate much more effectively.`;
  }

  if (lower.includes("meet")) {
    return `That depends on your preference, but I usually work best with a short recurring briefing and direct updates when decisions are needed. The goal is consistent visibility without creating unnecessary meetings.`;
  }

  if (lower.includes("different")) {
    return `I am structured around execution, not generic advice. My role is to take a specific function off your plate, keep work organized, and make it easier for you to review decisions instead of managing every detail yourself.`;
  }

  if (lower.includes("beginner")) {
    return `Yes, provided you are open about where you need help. If you are early, I adapt by giving more structure, clearer explanations, and a tighter rhythm so you are not guessing at the next step.`;
  }

  return `I would help by taking ownership of the ${worker.department.toLowerCase()} work this role is responsible for, turning your priorities into an operating plan, and keeping the work visible enough that you can step in only when decisions are actually needed.`;
}

const interviewGuides: Record<string, InterviewGuide> = {
  "lena-carter": {
    canHelpWith: [
      "Building a weekly UGC outreach plan",
      "Reviewing your portfolio and positioning",
      "Drafting brand pitches and follow-ups",
      "Organizing your creator pipeline"
    ],
    fitNotes: [
      "Strong fit for creators who want structure and consistency",
      "Best when you want help with outreach, positioning, and deal flow",
      "Works well if you want feedback tied to actual brand outcomes"
    ],
    needsFromYou: [
      "Your creator niche and ideal brand direction",
      "Portfolio or media kit links",
      "A sense of your experience level and confidence",
      "Approval rules for rates, outreach, and messaging"
    ],
    suggestedQuestions: [
      "How would you help me if I am trying to land more UGC deals?",
      "What do you need from me before you start outreach work?",
      "How would you handle my first month?",
      "Are you good for creators who feel overwhelmed?",
      "What makes you different from another UGC worker?"
    ],
    summary:
      "Lena interviews like a working UGC manager. She focuses on creator niche, positioning, outreach habits, brand fit, and weekly pitching discipline."
  },
  "david-chen": {
    canHelpWith: ["Building outbound lists", "Drafting first-touch sequences", "Keeping prospecting organized", "Improving sales handoff quality"],
    fitNotes: ["Strong fit for B2B teams that need disciplined outbound", "Best when ICP and offer are reasonably clear", "Useful if the founder wants more consistency in prospecting"],
    needsFromYou: ["Your target customer", "Offer positioning", "Approved outreach rules", "Examples of strong leads or accounts"],
    suggestedQuestions: [
      "How would you build my outbound process?",
      "What do you need from me before you start?",
      "How would you handle the first week?",
      "What kind of outreach do you avoid?",
      "What makes you different from another sales worker?"
    ],
    summary: "Miles interviews like an SDR candidate: clear on ICP, offer, sequence tone, and how he would manage prospecting discipline."
  }
};

export function getInterviewGuide(worker: Worker): InterviewGuide {
  const guide = interviewGuides[worker.slug];
  if (guide) return guide;

  return {
    canHelpWith: worker.profile.responsibilities.slice(0, 4),
    fitNotes: [
      `Strong fit if you need reliable ${worker.department.toLowerCase()} execution.`,
      `Best when you want clear ownership around the ${worker.title.toLowerCase()} function.`,
      "Works well if you prefer structured reviews over constant oversight."
    ],
    needsFromYou: [
      "Clear priorities",
      "Examples of strong work",
      "Approval rules",
      "Any context that affects how the role should operate"
    ],
    suggestedQuestions: baseSuggestedQuestions(worker),
    summary: worker.description
  };
}

export function generateInterviewReply(worker: Worker, question: string) {
  const lower = question.toLowerCase();

  if (worker.slug === "lena-carter") {
    if (lower.includes("help")) {
      return "If you hired me, I would start by understanding your niche, portfolio, current outreach habits, and the kinds of brands you want to work with. From there, I would build a weekly pitching plan, tighten your positioning, prepare outreach copy inside Ryva, track follow-ups, and help you get more consistent over time. You remain responsible for every external send.";
    }

    if (lower.includes("need from me")) {
      return "I need to understand what kind of creator you are, what brands you want to attract, what has already been tried, and where you want support most. If I have that context early, I can avoid generic advice and work much more like a real manager.";
    }

    if (lower.includes("first week")) {
      return "My first week would be about learning your brand direction, reviewing your portfolio, understanding your experience level, and mapping where your outreach process is breaking down. I would then build the first outreach priorities and show you exactly what I want to improve first.";
    }

    if (lower.includes("beginner")) {
      return "Yes. If you are newer, I become more structured. I would help you understand brand fit, tighten your portfolio, simplify your outreach, and keep the process manageable instead of overwhelming.";
    }

    if (lower.includes("different")) {
      return "I am not just giving ideas. I am operating the creator pipeline with you. That means I care about positioning, outreach quality, follow-up discipline, and which brands are actually worth your time.";
    }
  }

  if (worker.slug === "david-chen") {
    if (lower.includes("help")) {
      return "I would help by turning your target customer into an organized outbound system: account selection, lead research, first-touch messaging, follow-ups, and handoff notes once conversations begin.";
    }
  }

  return genericReply(worker, question);
}
