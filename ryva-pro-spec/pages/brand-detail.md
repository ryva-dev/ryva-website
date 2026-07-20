# Page: Brand Detail

## Purpose and user

Show Brand identity, Product portfolio, diligence, communication, representation authority, agreements, accounts, opportunities, economics, and risk in one record.

## Data displayed

Header: public/legal name, identity, pipeline/representation status, owner, next action, risk.  
Tabs:

- Overview and sourced AI summary;
- Products;
- Ownership and evidence;
- Contacts and communication history;
- Wholesale/distribution/operations;
- Representation Opportunity and terms;
- Agreements and Territories;
- Protected Accounts/conflicts;
- Placement Opportunities and Accounts;
- Tasks, Documents, Notes, History.

## Actions

Primary follows stage: Research, Prepare Contact, Log Conversation, Review Terms, Activate Agreement, Resolve Risk.  
Secondary: edit, add Product/Contact/evidence, draft outreach, upload agreement, pause/end, merge/archive.

## Filters

Product status; Contact role/verification; activity type; agreement status; Opportunity stage; account state; risk.

## States

- **Empty:** stage-appropriate evidence/Contact/term action.
- **Loading:** identity and authority state load first.
- **Error:** never hide agreement expiry or blocking risk; safe retry.

## Permissions and responsive

Representative edits; Agreement activation and protection require human approval. Mobile supports record lookup, Contacts, tasks, notes, risks, terms view, and approval; dense agreement comparison desktop-first.

## Linked records and AI

All Brand relationships. AI may draft summary, extract agreement candidates, identify missing terms, and suggest next action. Exact extraction requires confirmation.

## Acceptance criteria

- identity and representation authority are distinct;
- Product strength cannot conceal Brand risk;
- agreement scope controls downstream actions;
- communication quality shows evidence/rationale, not opaque score;
- ending Brand relationship initiates dependent-record workflow;
- history is complete.

