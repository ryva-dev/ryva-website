export type OfficeTaskStatus = "To Do" | "In Progress" | "Needs Review" | "Completed";

export type OfficeTask = {
  id: string;
  dueDate: string;
  module: string;
  owner: "Worker" | "You";
  priority: "Low" | "Medium" | "High";
  status: OfficeTaskStatus;
  title: string;
};

export type WorkLogEntry = {
  action: string;
  id: string;
  module: string;
  result: string;
  timestamp: string;
};

export type Briefing = {
  agenda: string[];
  dateLabel: string;
  decisionsNeeded: string[];
  id: string;
  recommendedActions: string[];
  summary: string;
  title: string;
};

export type KnowledgeSection = {
  items: string[];
  title: string;
};

export type WorkerFile = {
  name: string;
  type: string;
  updatedAt: string;
};

export type ChatMessage = {
  author: "Worker" | "You";
  id: string;
  text: string;
  timestamp: string;
};

export type WorkerModule = {
  columns: string[];
  id: string;
  name: string;
  rows: string[][];
  summary: string;
};

export type WorkerSetting = {
  label: string;
  value: string;
};

export type ReviewItem = {
  id: string;
  item: string;
  note: string;
};

export type SnapshotMetric = {
  label: string;
  value: string;
};

export type OfficeWorker = {
  blockedBy: string[];
  briefings: Briefing[];
  chat: ChatMessage[];
  currentFocus: string[];
  department: string;
  files: WorkerFile[];
  id: string;
  knowledge: KnowledgeSection[];
  modules: WorkerModule[];
  name: string;
  nextBriefing: string;
  recentWorkLog: WorkLogEntry[];
  reviewQueue: ReviewItem[];
  roleSummary: string;
  settings: WorkerSetting[];
  snapshot: SnapshotMetric[];
  tasks: OfficeTask[];
  title: string;
  todayWork: string[];
};

export type OfficeHomeData = {
  activity: string[];
  briefings: string[];
  review: string[];
  tasks: string[];
};

export const officeHomeData: OfficeHomeData = {
  activity: [
    "Lena Carter updated a deal pipeline and queued three follow-ups.",
    "Miles Reed drafted outbound messages for six priority accounts.",
    "June Ellis prepared meeting notes and updated next-week scheduling holds.",
    "Theo Brooks organized expense categories for June close."
  ],
  briefings: [
    "9:00 AM · Morning Brief with Lena Carter",
    "11:30 AM · Sales Review with Miles Reed",
    "2:00 PM · Admin Check-In with June Ellis",
    "4:15 PM · Finance Review with Theo Brooks"
  ],
  review: [
    "3 pitch drafts from Lena Carter",
    "2 lead lists from Miles Reed",
    "1 meeting prep packet from June Ellis",
    "1 invoice summary from Theo Brooks"
  ],
  tasks: [
    "Approve creator shortlist for Glowhouse campaign",
    "Review SDR sequence edits before tomorrow",
    "Confirm board-meeting travel with June",
    "Sign off on vendor invoice batch"
  ]
};

export const officeWorkers: OfficeWorker[] = [
  {
    blockedBy: ["Approval on two creator rates before final outreach.", "Updated media kit from the client team."],
    briefings: [
      {
        agenda: ["Review live brand leads", "Prioritize creator outreach", "Confirm rate strategy changes"],
        dateLabel: "Today · 9:00 AM",
        decisionsNeeded: ["Approve premium-rate targets", "Choose outreach order for top five brands"],
        id: "lena-morning-brief",
        recommendedActions: ["Approve rate band update", "Create follow-up task for revised portfolio links"],
        summary: "Lena has a strong outbound queue for the week and needs approval on rate positioning before sending the next batch.",
        title: "Morning Brief"
      },
      {
        agenda: ["Check pipeline stages", "Review warm replies", "Resolve blocked partnerships"],
        dateLabel: "Thursday · 2:30 PM",
        decisionsNeeded: ["Approve creator shortlist for Glowhouse", "Decide whether to pause two low-fit leads"],
        id: "lena-pipeline-review",
        recommendedActions: ["Ask for revised shortlist notes", "Create task for revised portfolio review"],
        summary: "The pipeline is healthy, but three warm opportunities need direction to move forward cleanly.",
        title: "Pipeline Review"
      }
    ],
    chat: [
      { author: "Worker", id: "lena-chat-1", text: "I moved the Glowhouse deal to review and attached revised pitch notes.", timestamp: "9:14 AM" },
      { author: "You", id: "lena-chat-2", text: "Good. Keep the rate framing conservative until I approve the shortlist.", timestamp: "9:22 AM" },
      { author: "Worker", id: "lena-chat-3", text: "Understood. I will hold outbound on the premium tier creators.", timestamp: "9:24 AM" }
    ],
    currentFocus: ["Creator outreach for Glowhouse and Sera Skin", "Portfolio clean-up for three mid-tier creators", "Follow-up queue due before end of day"],
    department: "Creator Economy",
    files: [
      { name: "Creator Portfolio Notes.pdf", type: "PDF", updatedAt: "Today" },
      { name: "Rate Strategy Q3.xlsx", type: "Spreadsheet", updatedAt: "Yesterday" },
      { name: "Brand Leads - Active.csv", type: "CSV", updatedAt: "Today" }
    ],
    id: "lena-carter",
    knowledge: [
      { title: "Goals", items: ["Secure 4 qualified brand conversations per week", "Improve creator portfolio readiness before outreach"] },
      { title: "Preferences", items: ["Use clear rate ranges early", "Prioritize beauty, wellness, and lifestyle brands"] },
      { title: "Rules", items: ["Do not send first outreach without portfolio link check", "Escalate rate objections above $2,500"] },
      { title: "Important context", items: ["Glowhouse wants creators with polished skincare routines", "Sera Skin prefers quick turnaround creators"] },
      { title: "Files", items: ["Creator media kits", "Rate strategy sheet", "Preferred brand list"] },
      { title: "Connected tools placeholder", items: ["Inbox", "Airtable", "Drive"] }
    ],
    modules: [
      {
        columns: ["Brand", "Fit", "Stage", "Next step"],
        id: "brand-leads",
        name: "Brand Leads",
        rows: [
          ["Glowhouse", "High", "Qualified", "Approve creator shortlist"],
          ["Sera Skin", "High", "Researching", "Prepare outreach notes"],
          ["Northline", "Medium", "Watching", "Revisit next week"]
        ],
        summary: "Active brand opportunities and fit scoring."
      },
      {
        columns: ["Creator", "Pitch status", "Rate band", "Due"],
        id: "pitch-tracker",
        name: "Pitch Tracker",
        rows: [
          ["Maya Ortiz", "Needs review", "$1.8k-$2.2k", "Today"],
          ["Ari Wells", "Drafted", "$2.4k-$2.8k", "Tomorrow"],
          ["Nina Fox", "Sent", "$1.2k-$1.6k", "Friday"]
        ],
        summary: "Current creator pitch drafts and delivery status."
      },
      {
        columns: ["Creator", "Gap", "Priority", "Owner"],
        id: "portfolio-review",
        name: "Portfolio Review",
        rows: [
          ["Maya Ortiz", "Short-form beauty examples", "High", "Worker"],
          ["Ari Wells", "Rate sheet refresh", "Medium", "Worker"],
          ["Nina Fox", "Brand bio rewrite", "Medium", "You"]
        ],
        summary: "Portfolio readiness issues before outreach."
      },
      {
        columns: ["Deal", "Stage", "Value", "Blocker"],
        id: "deal-pipeline",
        name: "Deal Pipeline",
        rows: [
          ["Glowhouse x Maya", "Needs review", "$2,400", "Rate approval"],
          ["Sera Skin x Ari", "Drafting", "$2,800", "Portfolio update"],
          ["Haven Studio x Nina", "Negotiation", "$1,600", "Brand legal review"]
        ],
        summary: "Live creator partnership pipeline."
      }
    ],
    name: "Lena Carter",
    nextBriefing: "Today at 9:00 AM · Morning Brief",
    recentWorkLog: [
      { action: "Updated creator shortlist for Glowhouse.", id: "lena-log-1", module: "Brand Leads", result: "3 high-fit creators prepared for review", timestamp: "8:42 AM" },
      { action: "Drafted follow-up outreach for Sera Skin.", id: "lena-log-2", module: "Pitch Tracker", result: "2 follow-up messages ready", timestamp: "Yesterday · 4:18 PM" },
      { action: "Marked Maya Ortiz portfolio for revision.", id: "lena-log-3", module: "Portfolio Review", result: "Needs new skincare examples", timestamp: "Yesterday · 1:07 PM" }
    ],
    reviewQueue: [
      { id: "lena-review-1", item: "Glowhouse pitch draft", note: "Approve rate framing before send" },
      { id: "lena-review-2", item: "Creator shortlist", note: "Choose final three profiles" },
      { id: "lena-review-3", item: "Portfolio notes", note: "Confirm revisions for Maya" }
    ],
    roleSummary: "Manages creator outreach, portfolio readiness, and brand deal pipeline activity.",
    settings: [
      { label: "Worker name", value: "Lena Carter" },
      { label: "Role", value: "UGC Talent Manager" },
      { label: "Department", value: "Creator Economy" },
      { label: "Goals", value: "Qualified outreach, portfolio readiness, signed partnerships" },
      { label: "Communication style", value: "Direct updates with decision points called out" },
      { label: "Briefing frequency", value: "Daily morning brief + weekly pipeline review" },
      { label: "Approval rules", value: "Approve rates above premium band and final brand shortlist" },
      { label: "Notification preferences", value: "Immediate on blocked deals, digest for completed outreach" },
      { label: "Connected accounts placeholder", value: "Inbox, Airtable, Drive" }
    ],
    snapshot: [
      { label: "Brands found", value: "12" },
      { label: "Pitches drafted", value: "5" },
      { label: "Follow-ups due", value: "7" },
      { label: "Portfolio gaps", value: "3" }
    ],
    tasks: [
      { dueDate: "Today", id: "lena-task-1", module: "Pitch Tracker", owner: "Worker", priority: "High", status: "Needs Review", title: "Finalize Glowhouse pitch draft" },
      { dueDate: "Tomorrow", id: "lena-task-2", module: "Portfolio Review", owner: "Worker", priority: "Medium", status: "In Progress", title: "Update Maya Ortiz portfolio notes" },
      { dueDate: "Friday", id: "lena-task-3", module: "Deal Pipeline", owner: "You", priority: "High", status: "To Do", title: "Approve creator shortlist" },
      { dueDate: "Yesterday", id: "lena-task-4", module: "Brand Leads", owner: "Worker", priority: "Low", status: "Completed", title: "Research Sera Skin partnership fit" }
    ],
    title: "UGC Talent Manager",
    todayWork: ["Draft three creator pitches", "Review active portfolio gaps", "Prepare brand follow-up list"]
  },
  {
    blockedBy: ["Final ICP revision for healthcare accounts.", "Decision on whether to pause the Q3 finance segment."],
    briefings: [
      {
        agenda: ["Review account tiers", "Approve sequence edits", "Check reply quality"],
        dateLabel: "Today · 11:30 AM",
        decisionsNeeded: ["Approve new first-touch opener", "Choose top ten accounts for executive outreach"],
        id: "miles-sales-review",
        recommendedActions: ["Create task for new healthcare list", "Review Q3 messaging rules"],
        summary: "Miles has enough researched accounts to start the next outbound wave once ICP edits are approved.",
        title: "Sales Review"
      }
    ],
    chat: [
      { author: "Worker", id: "miles-chat-1", text: "I finished the mid-market account list and grouped them by use case.", timestamp: "10:05 AM" },
      { author: "You", id: "miles-chat-2", text: "Good. Hold the healthcare sequence until I confirm ICP edits.", timestamp: "10:09 AM" }
    ],
    currentFocus: ["Researching mid-market SaaS accounts", "Drafting two outbound sequences", "Cleaning reply routing notes for AE handoff"],
    department: "Sales",
    files: [
      { name: "Priority Accounts.csv", type: "CSV", updatedAt: "Today" },
      { name: "Outbound Messaging Rules.docx", type: "Doc", updatedAt: "Yesterday" },
      { name: "Reply Routing Notes.pdf", type: "PDF", updatedAt: "Today" }
    ],
    id: "miles-reed",
    knowledge: [
      { title: "Goals", items: ["Book qualified meetings from target SaaS accounts", "Keep outbound volume disciplined and personalized"] },
      { title: "Preferences", items: ["Open with operational pain points", "Use short email structure with one CTA"] },
      { title: "Rules", items: ["No automation-first copy", "Escalate accounts above 500 employees"] },
      { title: "Important context", items: ["Healthcare ICP is under revision", "AE wants stronger handoff notes"] },
      { title: "Files", items: ["Priority account list", "Messaging rules", "Reply routing notes"] },
      { title: "Connected tools placeholder", items: ["CRM", "LinkedIn", "Sheets"] }
    ],
    modules: [
      {
        columns: ["Account", "Segment", "Priority", "Owner"],
        id: "accounts",
        name: "Accounts",
        rows: [
          ["North Peak", "SaaS", "High", "Worker"],
          ["Clearstep", "Healthcare", "High", "Worker"],
          ["Brindle", "Fintech", "Medium", "Worker"]
        ],
        summary: "Priority account list by segment."
      },
      {
        columns: ["Lead", "Title", "Account", "Status"],
        id: "leads",
        name: "Leads",
        rows: [
          ["Jess Moran", "Head of Ops", "North Peak", "Researched"],
          ["Adrian Bell", "VP Sales", "Brindle", "Needs review"],
          ["Nina Cole", "COO", "Clearstep", "Queued"]
        ],
        summary: "Lead research and review queue."
      },
      {
        columns: ["Sequence", "Audience", "Status", "Next send"],
        id: "sequences",
        name: "Sequences",
        rows: [
          ["Mid-market SaaS", "Ops leaders", "Drafted", "Tomorrow"],
          ["Finance tooling", "RevOps teams", "Active", "Today"],
          ["Healthcare", "Executives", "Blocked", "Pending ICP"]
        ],
        summary: "Outbound sequences and send timing."
      },
      {
        columns: ["Deal", "Stage", "Owner", "Next step"],
        id: "sales-pipeline",
        name: "Sales Pipeline",
        rows: [
          ["North Peak", "Meeting booked", "AE", "Send prep notes"],
          ["Brindle", "Reply received", "Worker", "Draft response"],
          ["Clearstep", "Research", "Worker", "Finish ICP review"]
        ],
        summary: "Sales opportunities and next actions."
      }
    ],
    name: "Miles Reed",
    nextBriefing: "Today at 11:30 AM · Sales Review",
    recentWorkLog: [
      { action: "Completed research for six mid-market accounts.", id: "miles-log-1", module: "Accounts", result: "3 moved to high priority", timestamp: "9:36 AM" },
      { action: "Drafted first-touch sequence for ops leaders.", id: "miles-log-2", module: "Sequences", result: "Needs review before send", timestamp: "Yesterday · 5:11 PM" },
      { action: "Updated AE handoff notes for booked meeting.", id: "miles-log-3", module: "Sales Pipeline", result: "Prep packet ready", timestamp: "Yesterday · 3:20 PM" }
    ],
    reviewQueue: [
      { id: "miles-review-1", item: "Mid-market SaaS sequence", note: "Approve first-touch opener" },
      { id: "miles-review-2", item: "Healthcare account list", note: "Confirm ICP edits before outreach" }
    ],
    roleSummary: "Runs outbound account research, prospecting, and sequence execution for priority pipeline growth.",
    settings: [
      { label: "Worker name", value: "Miles Reed" },
      { label: "Role", value: "Sales Development Representative" },
      { label: "Department", value: "Sales" },
      { label: "Goals", value: "Qualified meetings, clean handoffs, consistent outbound execution" },
      { label: "Communication style", value: "Concise with clear account-by-account updates" },
      { label: "Briefing frequency", value: "Daily sales review + weekly planning" },
      { label: "Approval rules", value: "Approve new sequences and new ICP segments before send" },
      { label: "Notification preferences", value: "Reply alerts immediately, research summaries end of day" },
      { label: "Connected accounts placeholder", value: "CRM, LinkedIn, Sheets" }
    ],
    snapshot: [
      { label: "Leads researched", value: "24" },
      { label: "Messages drafted", value: "11" },
      { label: "Replies received", value: "4" },
      { label: "Accounts prioritized", value: "9" }
    ],
    tasks: [
      { dueDate: "Today", id: "miles-task-1", module: "Sequences", owner: "Worker", priority: "High", status: "Needs Review", title: "Submit SaaS sequence for approval" },
      { dueDate: "Tomorrow", id: "miles-task-2", module: "Leads", owner: "Worker", priority: "Medium", status: "In Progress", title: "Finish Clearstep executive research" },
      { dueDate: "Friday", id: "miles-task-3", module: "Accounts", owner: "You", priority: "High", status: "To Do", title: "Approve healthcare ICP edits" },
      { dueDate: "Yesterday", id: "miles-task-4", module: "Sales Pipeline", owner: "Worker", priority: "Low", status: "Completed", title: "Update handoff notes for North Peak" }
    ],
    title: "Sales Development Representative",
    todayWork: ["Submit new outbound sequence", "Finish account research batch", "Update reply routing for AE handoffs"]
  },
  {
    blockedBy: ["Waiting on executive travel dates for next week.", "Board packet still missing legal appendix."],
    briefings: [
      {
        agenda: ["Confirm next-week calendar holds", "Review meeting prep needs", "Check open reminders"],
        dateLabel: "Today · 2:00 PM",
        decisionsNeeded: ["Approve travel hold for Denver", "Confirm board-meeting attendee list"],
        id: "june-admin-checkin",
        recommendedActions: ["Create task for final travel booking", "Review board packet checklist"],
        summary: "June has the office calendar under control but needs approvals to complete travel and board prep.",
        title: "Admin Check-In"
      }
    ],
    chat: [
      { author: "Worker", id: "june-chat-1", text: "I prepared the board packet checklist and flagged the missing legal appendix.", timestamp: "8:51 AM" },
      { author: "You", id: "june-chat-2", text: "Thanks. Keep the room hold open until we confirm final attendees.", timestamp: "9:03 AM" }
    ],
    currentFocus: ["Managing executive calendar changes", "Preparing board-meeting logistics", "Closing open reminders from this week"],
    department: "Admin",
    files: [
      { name: "Board Meeting Checklist.docx", type: "Doc", updatedAt: "Today" },
      { name: "Travel Holds.xlsx", type: "Spreadsheet", updatedAt: "Today" },
      { name: "Meeting Notes - Leadership.pdf", type: "PDF", updatedAt: "Yesterday" }
    ],
    id: "june-ellis",
    knowledge: [
      { title: "Goals", items: ["Keep executive scheduling clean", "Prepare complete meeting materials before every briefing"] },
      { title: "Preferences", items: ["One daily digest for routine updates", "Flag conflicts immediately"] },
      { title: "Rules", items: ["Do not finalize travel without executive approval", "Board packet needs final legal appendix before send"] },
      { title: "Important context", items: ["Executive calendar is tight next week", "Denver travel may shift by one day"] },
      { title: "Files", items: ["Board checklist", "Travel holds", "Leadership meeting notes"] },
      { title: "Connected tools placeholder", items: ["Calendar", "Docs", "Mail"] }
    ],
    modules: [
      {
        columns: ["Mailbox", "Status", "Owner", "Next action"],
        id: "inbox",
        name: "Inbox",
        rows: [
          ["Exec assistant shared", "Needs review", "Worker", "Sort follow-up flags"],
          ["Board prep", "Active", "Worker", "Await legal appendix"],
          ["Travel", "Watching", "You", "Confirm dates"]
        ],
        summary: "Inbox queues and triage status."
      },
      {
        columns: ["Meeting", "Date", "Status", "Blocker"],
        id: "calendar",
        name: "Calendar",
        rows: [
          ["Board review", "Thursday", "Preparing", "Legal appendix"],
          ["Denver client visit", "Next week", "Holding", "Travel approval"],
          ["Leadership sync", "Friday", "Ready", "None"]
        ],
        summary: "Calendar operations and scheduling blocks."
      },
      {
        columns: ["Meeting", "Notes status", "Owner", "Next action"],
        id: "meeting-notes",
        name: "Meeting Notes",
        rows: [
          ["Leadership sync", "Drafted", "Worker", "Send recap"],
          ["Board prep", "Queued", "Worker", "Prepare template"],
          ["Ops review", "Completed", "Worker", "Archive"]
        ],
        summary: "Meeting note preparation and delivery."
      },
      {
        columns: ["Reminder", "Due", "Priority", "Status"],
        id: "reminders",
        name: "Reminders",
        rows: [
          ["Confirm room hold", "Today", "High", "Open"],
          ["Follow up on travel dates", "Today", "Medium", "Blocked"],
          ["Send recap packet", "Tomorrow", "Low", "Queued"]
        ],
        summary: "Recurring reminders and follow-ups."
      }
    ],
    name: "June Ellis",
    nextBriefing: "Today at 2:00 PM · Admin Check-In",
    recentWorkLog: [
      { action: "Prepared board packet checklist.", id: "june-log-1", module: "Meeting Notes", result: "Awaiting legal appendix", timestamp: "8:17 AM" },
      { action: "Updated next-week calendar holds.", id: "june-log-2", module: "Calendar", result: "2 conflicts resolved", timestamp: "Yesterday · 4:05 PM" },
      { action: "Consolidated executive reminder queue.", id: "june-log-3", module: "Reminders", result: "5 reminders rescheduled", timestamp: "Yesterday · 2:40 PM" }
    ],
    reviewQueue: [
      { id: "june-review-1", item: "Travel hold plan", note: "Approve Denver dates" },
      { id: "june-review-2", item: "Board packet checklist", note: "Confirm final attendee list" }
    ],
    roleSummary: "Coordinates scheduling, meeting prep, reminders, and executive operations inside the private office.",
    settings: [
      { label: "Worker name", value: "June Ellis" },
      { label: "Role", value: "Executive Assistant" },
      { label: "Department", value: "Admin" },
      { label: "Goals", value: "Organized scheduling, complete meeting prep, disciplined reminders" },
      { label: "Communication style", value: "Structured updates with blockers listed first" },
      { label: "Briefing frequency", value: "Daily admin check-in + weekly planning" },
      { label: "Approval rules", value: "Approve travel and final board packet release" },
      { label: "Notification preferences", value: "Immediate on calendar conflicts, digest on completed prep" },
      { label: "Connected accounts placeholder", value: "Calendar, Mail, Docs" }
    ],
    snapshot: [
      { label: "Meetings prepared", value: "4" },
      { label: "Reminders active", value: "9" },
      { label: "Notes drafted", value: "3" },
      { label: "Conflicts resolved", value: "2" }
    ],
    tasks: [
      { dueDate: "Today", id: "june-task-1", module: "Calendar", owner: "You", priority: "High", status: "To Do", title: "Approve Denver travel dates" },
      { dueDate: "Today", id: "june-task-2", module: "Meeting Notes", owner: "Worker", priority: "High", status: "Needs Review", title: "Submit board packet checklist" },
      { dueDate: "Tomorrow", id: "june-task-3", module: "Reminders", owner: "Worker", priority: "Medium", status: "In Progress", title: "Finalize reminder queue for next week" },
      { dueDate: "Yesterday", id: "june-task-4", module: "Inbox", owner: "Worker", priority: "Low", status: "Completed", title: "Sort leadership inbox follow-ups" }
    ],
    title: "Executive Assistant",
    todayWork: ["Finalize board checklist", "Confirm room hold", "Review travel dependencies"]
  },
  {
    blockedBy: ["Pending approval on two vendor expense categories.", "Need signed copy of one contractor invoice."],
    briefings: [
      {
        agenda: ["Review invoice batch", "Check expense categorization", "Confirm report cutoffs"],
        dateLabel: "Today · 4:15 PM",
        decisionsNeeded: ["Approve contractor invoice correction", "Confirm software-expense categorization"],
        id: "theo-finance-review",
        recommendedActions: ["Create task for missing invoice signature", "Review monthly summary before send"],
        summary: "Theo has month-close moving well but two approvals are holding the final invoice and expense summary.",
        title: "Finance Review"
      }
    ],
    chat: [
      { author: "Worker", id: "theo-chat-1", text: "I grouped June expenses and flagged two software charges for approval.", timestamp: "11:02 AM" },
      { author: "You", id: "theo-chat-2", text: "Please hold the final report until the contractor invoice is signed.", timestamp: "11:09 AM" }
    ],
    currentFocus: ["Preparing vendor invoice batch", "Closing June expense categories", "Drafting month-end summary report"],
    department: "Finance",
    files: [
      { name: "Invoice Batch - June.xlsx", type: "Spreadsheet", updatedAt: "Today" },
      { name: "Expense Summary.pdf", type: "PDF", updatedAt: "Today" },
      { name: "Contractor Invoices.zip", type: "Archive", updatedAt: "Yesterday" }
    ],
    id: "theo-brooks",
    knowledge: [
      { title: "Goals", items: ["Maintain clean expense categories", "Prepare accurate invoice and report packages"] },
      { title: "Preferences", items: ["Flag unclear transactions quickly", "Group reviews by vendor batch"] },
      { title: "Rules", items: ["No report release without signed contractor invoice", "Escalate uncategorized software costs above threshold"] },
      { title: "Important context", items: ["June close is due this week", "Vendor categories changed on the 15th"] },
      { title: "Files", items: ["Invoice batch", "Expense summary", "Contractor invoice archive"] },
      { title: "Connected tools placeholder", items: ["Accounting software", "Drive", "Sheets"] }
    ],
    modules: [
      {
        columns: ["Transaction", "Vendor", "Category", "Status"],
        id: "transactions",
        name: "Transactions",
        rows: [
          ["#3341", "Ramp Labs", "Software", "Needs approval"],
          ["#3342", "Blue Ridge", "Travel", "Categorized"],
          ["#3343", "Studio Form", "Contractor", "Missing invoice"]
        ],
        summary: "Transaction review queue and categorization."
      },
      {
        columns: ["Invoice", "Recipient", "Amount", "Status"],
        id: "invoices",
        name: "Invoices",
        rows: [
          ["INV-204", "Studio Form", "$2,100", "Awaiting signature"],
          ["INV-205", "Northline", "$980", "Prepared"],
          ["INV-206", "Kite Health", "$1,420", "Ready to send"]
        ],
        summary: "Invoice preparation and signature state."
      },
      {
        columns: ["Expense group", "Items", "Owner", "Blocker"],
        id: "expenses",
        name: "Expenses",
        rows: [
          ["Software", "12", "Worker", "Category approval"],
          ["Travel", "4", "Worker", "None"],
          ["Contractors", "6", "You", "Signed invoice"]
        ],
        summary: "Expense categories and outstanding blockers."
      },
      {
        columns: ["Report", "Period", "Status", "Next step"],
        id: "reports",
        name: "Reports",
        rows: [
          ["June expense summary", "June", "Drafted", "Approve final categories"],
          ["Vendor invoice summary", "June", "In review", "Check missing signature"],
          ["Weekly cash notes", "This week", "Ready", "Send after briefing"]
        ],
        summary: "Report status and delivery readiness."
      }
    ],
    name: "Theo Brooks",
    nextBriefing: "Today at 4:15 PM · Finance Review",
    recentWorkLog: [
      { action: "Updated software expense categories.", id: "theo-log-1", module: "Expenses", result: "2 items pending approval", timestamp: "10:24 AM" },
      { action: "Prepared June vendor invoice batch.", id: "theo-log-2", module: "Invoices", result: "1 invoice awaiting signature", timestamp: "Yesterday · 4:42 PM" },
      { action: "Drafted June expense summary report.", id: "theo-log-3", module: "Reports", result: "Ready pending final approvals", timestamp: "Yesterday · 1:13 PM" }
    ],
    reviewQueue: [
      { id: "theo-review-1", item: "Software expense categories", note: "Approve two flagged vendor charges" },
      { id: "theo-review-2", item: "Vendor invoice batch", note: "Check contractor signature" }
    ],
    roleSummary: "Keeps invoices, transactions, expenses, and reporting organized inside the worker office.",
    settings: [
      { label: "Worker name", value: "Theo Brooks" },
      { label: "Role", value: "Bookkeeper" },
      { label: "Department", value: "Finance" },
      { label: "Goals", value: "Accurate transaction review, complete invoices, clean reporting" },
      { label: "Communication style", value: "Calm summaries with exact approvals needed" },
      { label: "Briefing frequency", value: "Weekly finance review + month-close checkpoints" },
      { label: "Approval rules", value: "Approve category exceptions and final invoice batches" },
      { label: "Notification preferences", value: "Immediate on blocked invoices, digest on completed reports" },
      { label: "Connected accounts placeholder", value: "Accounting software, Drive, Sheets" }
    ],
    snapshot: [
      { label: "Transactions reviewed", value: "42" },
      { label: "Invoices prepared", value: "6" },
      { label: "Expense groups updated", value: "3" },
      { label: "Reports generated", value: "2" }
    ],
    tasks: [
      { dueDate: "Today", id: "theo-task-1", module: "Expenses", owner: "You", priority: "High", status: "To Do", title: "Approve flagged software categories" },
      { dueDate: "Today", id: "theo-task-2", module: "Reports", owner: "Worker", priority: "High", status: "Needs Review", title: "Submit June expense summary" },
      { dueDate: "Tomorrow", id: "theo-task-3", module: "Invoices", owner: "Worker", priority: "Medium", status: "In Progress", title: "Collect contractor signature" },
      { dueDate: "Yesterday", id: "theo-task-4", module: "Transactions", owner: "Worker", priority: "Low", status: "Completed", title: "Categorize travel receipts" }
    ],
    title: "Bookkeeper",
    todayWork: ["Prepare vendor invoice batch", "Resolve expense category approvals", "Update month-end report draft"]
  }
];
