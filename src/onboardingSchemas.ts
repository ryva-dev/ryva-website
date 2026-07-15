import type { Worker } from "./types";

export type OnboardingQuestion = {
  helperText?: string;
  id: string;
  label: string;
  memoryKey: string;
  options?: string[];
  required?: boolean;
  type: "long-text" | "short-text" | "select" | "url";
};

export type OnboardingSection = {
  id: string;
  learningFocus: string[];
  questions: OnboardingQuestion[];
  title: string;
};

export type OnboardingSchema = {
  id: string;
  role: string;
  sections: OnboardingSection[];
};

export type OnboardingSessionState = {
  answers: Record<string, string>;
  completedAt?: string | null;
  generatedSummary: string[];
  status: "not_started" | "in_progress" | "completed";
};

export type OnboardingCompletionPayload = {
  briefing: {
    agenda: string[];
    dateLabel: string;
    decisionsNeeded: string[];
    recommendedActions: string[];
    summary: string;
    title: string;
  };
  firstDayNotice: string;
  knowledge: Array<{ items: string[]; title: string }>;
  summary: string[];
  tasks: Array<{
    dueDate: string;
    module: string;
    owner: "Worker" | "You";
    priority: "High" | "Low" | "Medium";
    status: "Completed" | "In Progress" | "Needs Review" | "To Do";
    title: string;
  }>;
  worklogEntry: {
    module: string;
    result: string;
  };
};

const schemas: Record<string, OnboardingSchema> = {
  "lena-carter": {
    id: "lena-carter",
    role: "UGC Talent Manager",
    sections: [
      {
        id: "background",
        learningFocus: ["Creator profile", "Platform history", "Portfolio links"],
        questions: [
          { id: "creator_background", label: "Tell me about yourself as a creator.", memoryKey: "Creator Profile", required: true, type: "long-text" },
          { id: "creator_tenure", label: "How long have you been creating UGC?", memoryKey: "Experience Level", required: true, type: "short-text" },
          { id: "creator_platforms", label: "What platforms do you create for?", memoryKey: "Platforms", required: true, type: "short-text" },
          { id: "creator_portfolio", label: "Do you have a portfolio or media kit link?", memoryKey: "Portfolio Links", type: "url" }
        ],
        title: "Background"
      },
      {
        id: "niche",
        learningFocus: ["Target niche", "Preferred brands", "Avoided brands"],
        questions: [
          { id: "target_niches", label: "What niches do you want to work in?", memoryKey: "Niche", required: true, type: "short-text" },
          { id: "dream_brands", label: "What brands would you love to work with?", memoryKey: "Preferred Brands", type: "long-text" },
          { id: "avoid_brands", label: "What brands or industries do you want to avoid?", memoryKey: "Avoided Brands", type: "long-text" },
          { id: "content_enjoyment", label: "What types of content do you enjoy making most?", memoryKey: "Content Preferences", type: "long-text" }
        ],
        title: "Niche"
      },
      {
        id: "experience",
        learningFocus: ["Paid deal history", "Outreach experience", "What has and has not worked"],
        questions: [
          { id: "paid_deals", label: "Have you landed paid UGC deals before?", memoryKey: "Deal History", required: true, type: "long-text" },
          { id: "outreach_history", label: "Have you done outreach before?", memoryKey: "Outreach Experience", type: "long-text" },
          { id: "what_worked", label: "What has worked so far?", memoryKey: "What Works", type: "long-text" },
          { id: "what_failed", label: "What has not worked?", memoryKey: "What To Avoid", type: "long-text" }
        ],
        title: "Experience"
      },
      {
        id: "goals",
        learningFocus: ["30-day goal", "Income goals", "Pitch volume"],
        questions: [
          { id: "main_goal", label: "What is your main goal for the next 30 days?", memoryKey: "Goals", required: true, type: "long-text" },
          { id: "income_goal", label: "What is your income goal from UGC?", memoryKey: "Income Goal", type: "short-text" },
          { id: "pitch_goal", label: "How many brands do you want to pitch per week?", memoryKey: "Pitch Goal", type: "short-text" },
          { id: "stage_goal", label: "Are you trying to land your first deal, become consistent, or scale?", memoryKey: "Current Stage", required: true, type: "select", options: ["Land first deal", "Become consistent", "Scale"] }
        ],
        title: "Goals"
      },
      {
        id: "help",
        learningFocus: ["Main challenges", "Needed support"],
        questions: [
          { id: "help_needed", label: "What do you need the most help with?", memoryKey: "Help Needed", required: true, type: "long-text" },
          { id: "overwhelming_part", label: "What part of the UGC process feels most overwhelming?", memoryKey: "Biggest Challenge", type: "long-text" }
        ],
        title: "Help needed"
      },
      {
        id: "work_style",
        learningFocus: ["Feedback style", "Update cadence", "Reasoning preference"],
        questions: [
          { id: "feedback_style", label: "How direct do you want feedback to be?", memoryKey: "Feedback Style", required: true, type: "select", options: ["Encouraging", "Balanced", "Blunt"] },
          { id: "update_rhythm", label: "Do you want daily check-ins, weekly briefings, or only updates when work is ready?", memoryKey: "Update Rhythm", required: true, type: "select", options: ["Daily check-ins", "Weekly briefings", "Only when work is ready"] },
          { id: "reasoning_preference", label: "Do you prefer me to explain my reasoning or just give recommendations?", memoryKey: "Reasoning Preference", type: "select", options: ["Explain reasoning", "Mostly recommendations", "Balanced"] }
        ],
        title: "Work style"
      },
      {
        id: "approval_rules",
        learningFocus: ["Approval rules", "Restricted brand language"],
        questions: [
          { id: "ask_before_drafting", label: "Should I always ask before drafting outreach?", memoryKey: "Approval Rules", type: "select", options: ["Yes", "No"] },
          { id: "ask_before_sending", label: "Should I always ask before sending or recommending external messages?", memoryKey: "Approval Rules", type: "select", options: ["Yes", "No"] },
          { id: "approve_every_pitch", label: "Do you want to approve every pitch before it is used?", memoryKey: "Approval Rules", type: "select", options: ["Yes", "No"] },
          { id: "never_suggest", label: "Are there any brands, claims, or content styles I should never suggest?", memoryKey: "Avoided Brands", type: "long-text" }
        ],
        title: "Approval rules"
      }
    ]
  },
  "miles-reed": {
    id: "miles-reed",
    role: "Sales Development Representative",
    sections: [
      {
        id: "sales-background",
        learningFocus: ["Target customer", "Offer", "ICP"],
        questions: [
          { id: "target_customer", label: "Who is your ideal customer?", memoryKey: "Target Customer", required: true, type: "long-text" },
          { id: "industries", label: "Which industries matter most right now?", memoryKey: "Industries", type: "short-text" },
          { id: "offer", label: "What are you selling?", memoryKey: "Offer", required: true, type: "long-text" }
        ],
        title: "Targeting"
      },
      {
        id: "sales-process",
        learningFocus: ["Lead sources", "Tone", "CRM rules"],
        questions: [
          { id: "lead_sources", label: "Where do your best leads come from right now?", memoryKey: "Lead Sources", type: "long-text" },
          { id: "outreach_tone", label: "What tone should outreach use?", memoryKey: "Outreach Tone", type: "long-text" },
          { id: "crm_rules", label: "What CRM rules should I follow?", memoryKey: "CRM Rules", type: "long-text" },
          { id: "approval_rules", label: "What outreach needs approval before I use it?", memoryKey: "Approval Rules", type: "long-text" }
        ],
        title: "Process"
      }
    ]
  },
  "june-ellis": {
    id: "june-ellis",
    role: "Executive Assistant",
    sections: [
      {
        id: "assistant-rhythm",
        learningFocus: ["Working hours", "Scheduling", "Priority contacts"],
        questions: [
          { id: "working_hours", label: "What working hours should I optimize around?", memoryKey: "Working Hours", required: true, type: "short-text" },
          { id: "scheduling_preferences", label: "What are your scheduling preferences?", memoryKey: "Scheduling Preferences", required: true, type: "long-text" },
          { id: "priority_contacts", label: "Who are your priority contacts?", memoryKey: "Priority Contacts", type: "long-text" }
        ],
        title: "Schedule"
      },
      {
        id: "assistant-ops",
        learningFocus: ["Communication style", "Recurring duties", "Approval rules"],
        questions: [
          { id: "communication_style", label: "How should I communicate with you?", memoryKey: "Communication Style", type: "long-text" },
          { id: "recurring_responsibilities", label: "What recurring responsibilities matter most?", memoryKey: "Recurring Responsibilities", type: "long-text" },
          { id: "travel_preferences", label: "Any travel or logistics preferences?", memoryKey: "Travel Preferences", type: "long-text" },
          { id: "assistant_approval_rules", label: "What should never be finalized without your approval?", memoryKey: "Approval Rules", type: "long-text" }
        ],
        title: "Operating style"
      }
    ]
  },
  "theo-brooks": {
    id: "theo-brooks",
    role: "Bookkeeper",
    sections: [
      {
        id: "finance-setup",
        learningFocus: ["Business model", "Software", "Documents needed"],
        questions: [
          { id: "business_type", label: "What kind of business are you running?", memoryKey: "Business Type", required: true, type: "short-text" },
          { id: "accounting_software", label: "What accounting software do you use?", memoryKey: "Accounting Software", type: "short-text" },
          { id: "docs_needed", label: "What documents should I expect from you regularly?", memoryKey: "Documents Needed", type: "long-text" }
        ],
        title: "Finance setup"
      },
      {
        id: "finance-rules",
        learningFocus: ["Expense categories", "Reporting cadence", "Approvals"],
        questions: [
          { id: "expense_categories", label: "Any expense categories you care about most?", memoryKey: "Expense Categories", type: "long-text" },
          { id: "invoice_preferences", label: "How should I handle invoice follow-up and organization?", memoryKey: "Invoice Preferences", type: "long-text" },
          { id: "reporting_cadence", label: "How often do you want financial reporting?", memoryKey: "Reporting Cadence", type: "short-text" },
          { id: "finance_approval_rules", label: "What financial work needs your approval?", memoryKey: "Approval Rules", type: "long-text" }
        ],
        title: "Finance rules"
      }
    ]
  },
  "mara-vale": {
    id: "mara-vale",
    role: "Creator Growth and Creative Intelligence Manager",
    sections: [
      {
        id: "brand",
        learningFocus: ["Your niche", "Dream brands", "Where you are right now"],
        questions: [
          {
            id: "niche_focus",
            label: "Tell me about your content in your own words — what do you make, who's it for, and what makes it unmistakably yours?",
            helperText: "Be specific. 'Fitness and wellness for busy professionals' teaches me more than 'UGC'.",
            memoryKey: "Preferences",
            required: true,
            type: "long-text"
          },
          {
            id: "dream_brands",
            label: "Which brands would be a dream to land — and what kinds would you turn down no matter the money?",
            helperText: "Name names if you have them. This shapes every pitch and every lead I bring you.",
            memoryKey: "Goals",
            required: true,
            type: "long-text"
          },
          {
            id: "current_stage",
            label: "Where are you right now — recent wins, rates you've charged, how full your pipeline feels?",
            helperText: "No wrong answer. If you're just starting, say so and I'll plan for that.",
            memoryKey: "Goals",
            type: "long-text"
          },
          {
            id: "creator_profiles",
            label: "Where can I review your work and audience today? Share your portfolio and any public Instagram, TikTok, YouTube, or other creator profile links.",
            helperText: "Paste one or several links. Leave this blank if you do not have them yet.",
            memoryKey: "Creator Profiles",
            type: "long-text"
          }
        ],
        title: "Your brand"
      },
      {
        id: "workflow",
        learningFocus: ["Current workflow", "What falls through the cracks", "Where chaos starts"],
        questions: [
          { id: "current_workflow", label: "Walk me through how a brand deal flows today, from first email to getting paid. Where does it all live — inbox, notes, spreadsheets, memory?", memoryKey: "Current Workflow", required: true, type: "long-text" },
          { id: "workflow_breakdowns", label: "Tell me about the last time something slipped — a follow-up, a deadline, a payment. What happened?", memoryKey: "Pain points", required: true, type: "long-text" },
          { id: "biggest_admin_drag", label: "If I could take exactly one recurring chore off your plate this week, which would buy back the most time?", memoryKey: "Pain points", required: true, type: "long-text" }
        ],
        title: "How you work"
      },
      {
        id: "email",
        learningFocus: ["Email handling", "Inbox priorities", "Optional integrations"],
        questions: [
          { id: "email_volume", label: "When I'm watching your inbox, what should I treat as urgent — and what's noise I should quietly file?", memoryKey: "Inbox Priorities", required: true, type: "long-text" },
          { id: "reply_boundaries", label: "Where's my line? What can I draft and organize freely, and what should always come to you untouched?", memoryKey: "Reply Boundaries", required: true, type: "long-text" },
          { id: "integration_interest", label: "Want to connect Gmail or Outlook later so I can work your inbox directly?", memoryKey: "Integration Intent", type: "select", options: ["Yes, later", "Maybe later", "No, keep it manual"] }
        ],
        title: "Inbox rules"
      },
      {
        id: "operations",
        learningFocus: ["Real availability", "Filming logistics", "Review rhythm", "Approvals", "Deadlines"],
        questions: [
          { id: "fixed_commitments", label: "What parts of a normal week are already spoken for — work, school, commute, caregiving, appointments, sleep?", helperText: "For example: I work 9–5 Monday–Friday and commute until 6.", memoryKey: "Availability", required: true, type: "long-text" },
          { id: "creator_availability", label: "When can you realistically do creator work, and how many hours can you protect in a normal week?", helperText: "Give me real windows, not an ideal week. I will keep your calendar inside this capacity.", memoryKey: "Availability", required: true, type: "long-text" },
          { id: "filming_preferences", label: "How does filming fit your life — preferred days, locations, outings I can plan around, and anything that makes a filming block impractical?", memoryKey: "Filming Logistics", required: true, type: "long-text" },
          { id: "review_preferences", label: "When should I put short review windows on your calendar for pitches, concepts, and other work I prepare?", memoryKey: "Review Rhythm", required: true, type: "long-text" },
          { id: "deadline_style", label: "How do you want me to handle deadlines — gentle nudges early, a hard flag the day before, or both?", memoryKey: "Deadline Style", required: true, type: "long-text" },
          { id: "approval_rules", label: "What should never happen without your sign-off?", helperText: "For example: anything sent to a brand, anything involving money, anything public.", memoryKey: "Approval rules", required: true, type: "long-text" },
          { id: "daily_output", label: "When you check in on me at the end of a day, what do you want waiting for you?", memoryKey: "Daily Output", type: "long-text" }
        ],
        title: "Operating rules"
      }
    ]
  }
};

function defaultSchema(worker: Worker): OnboardingSchema {
  return {
    id: worker.slug,
    role: worker.title,
    sections: [
      {
        id: "background",
        learningFocus: ["Goals", "Preferences", "Approval rules"],
        questions: [
          { id: "role_goals", label: `What do you want from your ${worker.title.toLowerCase()} in the next 30 days?`, memoryKey: "Goals", required: true, type: "long-text" },
          { id: "work_preferences", label: "How do you like updates and reviews to work?", memoryKey: "Preferences", type: "long-text" },
          { id: "approval_rules", label: "What should always require your approval?", memoryKey: "Approval Rules", type: "long-text" }
        ],
        title: "Background"
      }
    ]
  };
}

export function getOnboardingSchema(worker: Worker) {
  if (["sloane-pierce", "etta-marsh", "rowan-feld"].includes(worker.slug)) {
    return schemas["lena-carter"];
  }
  if (worker.slug === "june-okafor") {
    return schemas["june-ellis"];
  }
  if (worker.slug === "david-chen") {
    return schemas["miles-reed"];
  }
  return schemas[worker.slug] ?? defaultSchema(worker);
}

function answer(answers: Record<string, string>, key: string, fallback = "Not provided") {
  return answers[key]?.trim() || fallback;
}

export function buildOnboardingCompletionPayload(worker: Worker, answers: Record<string, string>): OnboardingCompletionPayload {
  if (worker.slug === "mara-vale") {
    const summary = [
      `Current workflow: ${answer(answers, "current_workflow")}`,
      `Creator profiles: ${answer(answers, "creator_profiles", "Not provided")}`,
      `Breakdowns to fix: ${answer(answers, "workflow_breakdowns")}`,
      `Admin bottleneck: ${answer(answers, "biggest_admin_drag")}`,
      `Inbox priorities: ${answer(answers, "email_volume")}`,
      `Reply boundaries: ${answer(answers, "reply_boundaries")}`,
      `Integration intent: ${answer(answers, "integration_interest", "Not decided")}`,
      `Fixed commitments: ${answer(answers, "fixed_commitments")}`,
      `Creator availability: ${answer(answers, "creator_availability")}`,
      `Filming logistics: ${answer(answers, "filming_preferences")}`,
      `Review rhythm: ${answer(answers, "review_preferences")}`,
      `Deadline style: ${answer(answers, "deadline_style")}`,
      `Approval rules: ${answer(answers, "approval_rules")}`,
      `Daily output: ${answer(answers, "daily_output")}`
    ];

    return {
      briefing: {
        agenda: ["Review inbox and workflow priorities", "Confirm approval boundaries", "Agree on deadline and reminder handling"],
        dateLabel: "Tomorrow · 9:30 AM",
        decisionsNeeded: ["Confirm what should stay manual versus delegated", "Decide whether inbox access should be connected later"],
        recommendedActions: ["Set first operating checklist", "Build the first campaign-tracking rhythm"],
        summary: "Mara documented your workflow, inbox priorities, and approval boundaries so she can operate as a real coordinator instead of a generic assistant.",
        title: "Operations Onboarding Briefing"
      },
      firstDayNotice: "I'm Mara. I captured how you run campaigns, what should stay manual, and what I can own — I'm already setting up my desk around your brand.",
      knowledge: [
        { title: "Preferences", items: normalizeSummaryItems(answer(answers, "niche_focus", "")) },
        { title: "Goals", items: normalizeSummaryItems(answer(answers, "current_stage", "")) },
        { title: "Preferred Brands", items: normalizeSummaryItems(answer(answers, "dream_brands", "")) },
        { title: "Creator Profiles", items: normalizeSummaryItems(answer(answers, "creator_profiles", "")) },
        { title: "Current Workflow", items: normalizeSummaryItems(answer(answers, "current_workflow")) },
        { title: "Pain points", items: [...normalizeSummaryItems(answer(answers, "workflow_breakdowns")), ...normalizeSummaryItems(answer(answers, "biggest_admin_drag"))] },
        { title: "Inbox Priorities", items: normalizeSummaryItems(answer(answers, "email_volume")) },
        { title: "Reply Boundaries", items: normalizeSummaryItems(answer(answers, "reply_boundaries")) },
        { title: "Integration Intent", items: [answer(answers, "integration_interest", "Not decided")] },
        { title: "Availability", items: [...normalizeSummaryItems(answer(answers, "fixed_commitments")), ...normalizeSummaryItems(answer(answers, "creator_availability"))] },
        { title: "Filming Logistics", items: normalizeSummaryItems(answer(answers, "filming_preferences")) },
        { title: "Review Rhythm", items: normalizeSummaryItems(answer(answers, "review_preferences")) },
        { title: "Approval rules", items: normalizeSummaryItems(answer(answers, "approval_rules")) },
        { title: "Operating Rules", items: [answer(answers, "deadline_style"), answer(answers, "daily_output")] }
      ],
      summary,
      tasks: [],
      worklogEntry: {
        module: "Onboarding",
        result: "I learned your workflow, inbox priorities, and approval boundaries."
      }
    };
  }

  if (["sloane-pierce", "etta-marsh", "rowan-feld"].includes(worker.slug)) {
    worker = { ...worker, slug: "lena-carter" } as Worker;
  }

  if (worker.slug === "david-chen") {
    const summary = [
      `Target customer: ${answer(answers, "target_customer")}`,
      `Industries: ${answer(answers, "industries")}`,
      `Offer: ${answer(answers, "offer")}`,
      `Lead sources: ${answer(answers, "lead_sources")}`,
      `Outreach tone: ${answer(answers, "outreach_tone")}`,
      `CRM rules: ${answer(answers, "crm_rules")}`,
      `Approval rules: ${answer(answers, "approval_rules")}`
    ];

    return {
      briefing: {
        agenda: ["Review ICP and offer", "Approve first outreach direction", "Confirm CRM rules"],
        dateLabel: "Tomorrow · 11:00 AM",
        decisionsNeeded: ["Approve first sequence direction", "Confirm protected accounts or industries"],
        recommendedActions: ["Build first account list", "Draft first-touch messaging"],
        summary: "David prepared an outbound working plan based on your ICP, offer, and approval rules.",
        title: "Sales Onboarding Briefing"
      },
      firstDayNotice: "David has joined your office. He documented your ICP, prepared first-day outbound work, and set up his first briefing.",
      knowledge: [
        { title: "Target Customer", items: [answer(answers, "target_customer"), answer(answers, "industries")] },
        { title: "Offer", items: [answer(answers, "offer")] },
        { title: "Lead Sources", items: normalizeSummaryItems(answer(answers, "lead_sources")) },
        { title: "Outreach Tone", items: [answer(answers, "outreach_tone")] },
        { title: "CRM Rules", items: normalizeSummaryItems(answer(answers, "crm_rules")) },
        { title: "Approval Rules", items: normalizeSummaryItems(answer(answers, "approval_rules")) }
      ],
      summary,
      tasks: [
        { dueDate: "Today", module: "Accounts", owner: "Worker", priority: "High", status: "To Do", title: "Build first ICP-aligned account list" },
        { dueDate: "Tomorrow", module: "Sequences", owner: "Worker", priority: "High", status: "To Do", title: "Draft first-touch outbound sequence" }
      ],
      worklogEntry: {
        module: "Onboarding",
        result: "Outbound context and approval rules recorded"
      }
    };
  }

  if (worker.slug === "lena-carter") {
    const summary = [
      `Creator type: ${answer(answers, "creator_background")}`,
      `Niche: ${answer(answers, "target_niches")}`,
      `Experience level: ${answer(answers, "creator_tenure")}`,
      `Goals: ${answer(answers, "main_goal")}`,
      `Preferred brands: ${answer(answers, "dream_brands")}`,
      `Avoided brands: ${answer(answers, "avoid_brands")}`,
      `Biggest challenges: ${answer(answers, "help_needed")}`,
      `Work style: ${answer(answers, "feedback_style")} feedback, ${answer(answers, "update_rhythm")}`,
      `Approval rules: Drafting ${answer(answers, "ask_before_drafting")}, outreach ${answer(answers, "ask_before_sending")}, pitch approvals ${answer(answers, "approve_every_pitch")}`,
      `First recommended plan: Build a focused weekly pitch list, tighten portfolio positioning, and create a repeatable follow-up rhythm around ${answer(answers, "target_niches")}.`
    ];

    return {
      briefing: {
        agenda: ["Review creator goals", "Approve first target brand list", "Confirm outreach rhythm"],
        dateLabel: "Tomorrow · 9:00 AM",
        decisionsNeeded: ["Confirm first pitching priorities", "Approve any protected industries or brands"],
        recommendedActions: ["Review portfolio positioning", "Create first outreach batch"],
        summary: "Lena prepared a first working plan based on the creator profile, niche, and outreach needs collected during onboarding.",
        title: "First Week Briefing"
      },
      firstDayNotice: "Lena has joined your office. She created your first outreach plan, added initial goals, and prepared your first briefing.",
      knowledge: [
        { title: "Creator Profile", items: [answer(answers, "creator_background"), `Platforms: ${answer(answers, "creator_platforms")}`, `Portfolio: ${answer(answers, "creator_portfolio", "No portfolio link provided")}`] },
        { title: "Niche", items: [answer(answers, "target_niches"), `Preferred content: ${answer(answers, "content_enjoyment")}`] },
        { title: "Experience Level", items: [answer(answers, "creator_tenure"), answer(answers, "paid_deals"), answer(answers, "outreach_history")] },
        { title: "Goals", items: [answer(answers, "main_goal"), `Income goal: ${answer(answers, "income_goal")}`, `Pitch goal: ${answer(answers, "pitch_goal")}`, `Stage: ${answer(answers, "stage_goal")}`] },
        { title: "Preferred Brands", items: normalizeSummaryItems(answer(answers, "dream_brands")) },
        { title: "Avoided Brands", items: normalizeSummaryItems(`${answer(answers, "avoid_brands")}\n${answer(answers, "never_suggest", "")}`) },
        { title: "Outreach Preferences", items: [answer(answers, "what_worked"), answer(answers, "what_failed"), answer(answers, "reasoning_preference")] },
        { title: "Feedback Style", items: [answer(answers, "feedback_style"), answer(answers, "update_rhythm")] },
        { title: "Approval Rules", items: [answer(answers, "ask_before_drafting"), answer(answers, "ask_before_sending"), answer(answers, "approve_every_pitch")] }
      ],
      summary,
      tasks: [
        { dueDate: "Today", module: "Onboarding", owner: "Worker", priority: "High", status: "To Do", title: "Review creator portfolio and current positioning" },
        { dueDate: "Tomorrow", module: "Pitch Tracker", owner: "Worker", priority: "High", status: "To Do", title: "Build first weekly target brand list" },
        { dueDate: "Tomorrow", module: "Briefings", owner: "You", priority: "Medium", status: "Needs Review", title: "Approve first outreach priorities for Lena" }
      ],
      worklogEntry: {
        module: "Onboarding",
        result: "First outreach plan and working preferences recorded"
      }
    };
  }

  const schema = getOnboardingSchema(worker);
  const summary = schema.sections.flatMap((section) =>
    section.questions.slice(0, 2).map((question) => `${question.label} ${answer(answers, question.id)}`)
  );

  return {
    briefing: {
      agenda: ["Review onboarding context", "Confirm first priorities", "Agree on approval rhythm"],
      dateLabel: "Tomorrow · 10:00 AM",
      decisionsNeeded: ["Approve first work batch", "Confirm communication expectations"],
      recommendedActions: ["Finalize first priorities", "Create role-specific follow-up tasks"],
      summary: `${worker.name} completed onboarding and prepared a first working plan based on your answers.`,
      title: "First Week Briefing"
    },
    firstDayNotice: `${worker.name} has joined your office. ${worker.name.split(" ")[0]} prepared first-day tasks and a briefing based on your onboarding answers.`,
    knowledge: schema.sections.map((section) => ({
      items: section.questions.map((question) => `${question.memoryKey}: ${answer(answers, question.id)}`),
      title: section.title
    })),
    summary,
    tasks: [
      { dueDate: "Today", module: "Onboarding", owner: "Worker", priority: "High", status: "To Do", title: `Review onboarding context for ${worker.name}` },
      { dueDate: "Tomorrow", module: "Work Queue", owner: "Worker", priority: "Medium", status: "To Do", title: `Prepare first ${worker.department.toLowerCase()} work batch` }
    ],
    worklogEntry: {
      module: "Onboarding",
      result: "First-day operating context recorded"
    }
  };
}

function normalizeSummaryItems(text: string) {
  return text
    .split(/\n|,|•/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}
