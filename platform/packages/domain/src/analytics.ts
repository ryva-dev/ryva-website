import type { Database, Transaction } from "../../database/src/index.js";
import { withTransaction } from "../../database/src/index.js";
import { AppError, newId } from "../../shared/src/index.js";
import { publicDigest } from "./crypto.js";
import { recordAudit } from "./audit.js";
import { enqueueJob } from "./jobs.js";

export type MetricDefinition = {
  code: string;
  name: string;
  businessMeaning: string;
  formula: string;
  includedRecords: string;
  excludedRecords: string;
  dateBehavior: string;
  currencyBehavior: string;
  valueStatus: "actual" | "verified" | "estimated" | "projected" | "mixed";
  freshnessBehavior: string;
  knownLimitations: string;
  sourceRecordTypes: string[];
  version: number;
};

const commonDate = "Uses the selected period in the workspace time zone; end date is inclusive.";
const noCurrency = "Not monetary.";
const separateCurrency = "Grouped by ISO currency; currencies are never combined.";

function metric(
  code: string,
  name: string,
  formula: string,
  sourceRecordTypes: string[],
  options: Partial<MetricDefinition> = {}
): MetricDefinition {
  return {
    code,
    name,
    businessMeaning: options.businessMeaning ?? name,
    formula,
    includedRecords: options.includedRecords ?? "Current, workspace-authorized records matching the visible filters.",
    excludedRecords: options.excludedRecords ?? "Archived records and records outside the visible filters.",
    dateBehavior: options.dateBehavior ?? commonDate,
    currencyBehavior: options.currencyBehavior ?? noCurrency,
    valueStatus: options.valueStatus ?? "actual",
    freshnessBehavior: options.freshnessBehavior ?? "Calculated at request time from current stored records.",
    knownLimitations: options.knownLimitations ?? "Describes activity inside Ryva; it does not prove general market demand or causation.",
    sourceRecordTypes,
    version: 1
  };
}

export const metricDictionary: MetricDefinition[] = [
  metric("outreach_volume","Outreach volume","Count of outbound Outreach Messages created in the period.",["outreach_message"]),
  metric("approved_messages","Approved messages","Count of outbound messages with an approved exact-content artifact.",["outreach_message","human_approval"]),
  metric("sent_messages","Sent messages","Count of outbound messages accepted by a provider or confirmed manually.",["outreach_message","activity"]),
  metric("delivery_rate","Delivery rate","Delivered outbound messages ÷ provider-accepted outbound messages.",["outreach_message","outreach_provider_event"]),
  metric("bounce_rate","Bounce rate","Bounced outbound messages ÷ provider-accepted outbound messages.",["outreach_message","outreach_provider_event"]),
  metric("complaint_rate","Complaint rate","Complaint provider events ÷ provider-accepted outbound messages.",["outreach_provider_event","outreach_message"]),
  metric("opt_out_rate","Opt-out rate","Opt-out events or active opt-out suppressions ÷ provider-accepted outbound messages.",["outreach_provider_event","communication_suppression"]),
  metric("reply_rate","Reply rate","Outbound threads with a recorded reply ÷ provider-accepted outbound messages.",["outreach_message"]),
  metric("positive_response_rate","Positive-response rate","Replies classified Interested ÷ classified replies.",["outreach_message"]),
  metric("conversation_rate","Conversation rate","Replies classified Interested, Question, or Objection ÷ provider-accepted outbound messages.",["outreach_message"]),
  metric("information_sample_rate","Information/sample-sent rate","Placement Opportunities reaching Information/Sample Sent or later ÷ contacted Placement Opportunities.",["placement_opportunity","placement_stage_event"]),
  metric("opening_order_count","Opening-order count","Count of verified opening Orders in the period.",["order"],{valueStatus:"verified"}),
  metric("reorder_count","Reorder count","Count of verified reorder Orders in the period.",["order","reorder"],{valueStatus:"verified"}),
  metric("reorder_rate","Reorder rate","Active Accounts with at least one verified reorder ÷ Accounts with a verified opening Order.",["account","order"],{valueStatus:"verified"}),
  metric("verified_wholesale_value","Verified wholesale order value","Sum of net commissionable value for verified Orders.",["order"],{currencyBehavior:separateCurrency,valueStatus:"verified"}),
  metric("opening_order_value","Opening-order value","Sum of verified net commissionable opening Orders.",["order"],{currencyBehavior:separateCurrency,valueStatus:"verified"}),
  metric("reorder_value","Reorder value","Sum of verified net commissionable reorder Orders.",["order"],{currencyBehavior:separateCurrency,valueStatus:"verified"}),
  metric("gross_wholesale_value","Gross wholesale value","Sum of wholesale gross for verified Orders.",["order"],{currencyBehavior:separateCurrency,valueStatus:"verified"}),
  metric("discounts","Discounts","Sum of discounts on verified Orders.",["order"],{currencyBehavior:separateCurrency,valueStatus:"verified"}),
  metric("returns","Returns","Sum of returns on verified Orders.",["order"],{currencyBehavior:separateCurrency,valueStatus:"verified"}),
  metric("cancellations","Cancellations","Sum of cancellations on verified Orders.",["order"],{currencyBehavior:separateCurrency,valueStatus:"verified"}),
  metric("net_commissionable_value","Net commissionable value","Gross minus discounts, returns, and cancellations from the current verified Order revision.",["order","order_revision"],{currencyBehavior:separateCurrency,valueStatus:"verified"}),
  metric("expected_commission","Expected commission","Sum of latest explainable Commission calculation results.",["commission","commission_calculation"],{currencyBehavior:separateCurrency,valueStatus:"estimated"}),
  metric("approved_commission","Approved commission","Sum of human-approved Commission amounts.",["commission"],{currencyBehavior:separateCurrency,valueStatus:"actual"}),
  metric("payable_commission","Payable commission","Approved amounts for Commissions currently Payable.",["commission"],{currencyBehavior:separateCurrency,valueStatus:"actual"}),
  metric("paid_commission","Paid commission","Sum of evidence-confirmed paid Commission amounts.",["commission"],{currencyBehavior:separateCurrency,valueStatus:"actual"}),
  metric("disputed_commission","Disputed commission","Sum of open Commission Dispute amounts.",["commission_dispute"],{currencyBehavior:separateCurrency,valueStatus:"actual"}),
  metric("overdue_commission","Overdue commission","Approved or payable Commission amounts past documented due date and not paid.",["commission"],{currencyBehavior:separateCurrency,valueStatus:"actual"}),
  metric("clawbacks","Clawbacks","Sum of applied Commission clawback amounts.",["commission"],{currencyBehavior:separateCurrency,valueStatus:"actual"}),
  metric("average_sales_cycle","Average sales-cycle duration","Average days from Placement Opportunity creation to verified opening Order date.",["placement_opportunity","order"]),
  metric("opportunities_won","Opportunities won","Count of Placement Opportunities reaching Active Account or Reorder Management.",["placement_opportunity"]),
  metric("opportunities_lost","Opportunities lost","Count of Placement Opportunities in Closed Lost.",["placement_opportunity"]),
  metric("stalled_opportunities","Stalled opportunities","Open Placement Opportunities with no next action, overdue next action, or no meaningful action for 14 days.",["placement_opportunity","task"]),
  metric("next_action_coverage","Next-action coverage","Open Placement Opportunities with a current open next-action Task ÷ all open Placement Opportunities.",["placement_opportunity","task"]),
  metric("active_products","Active products","Current represented Products.",["product","representation_agreement"]),
  metric("buyer_matches","Buyer matches","Current Product-to-Business match reviews.",["product_business_match"]),
  metric("qualified_businesses","Qualified businesses","Business records with a current human-owned Qualified decision.",["business"]),
  metric("active_representation_relationships","Active representation relationships","Human-approved active Representation Agreements.",["representation_agreement"]),
  metric("products_represented","Products represented","Distinct Products in active Agreement scope.",["representation_agreement","product"]),
  metric("accounts_opened","Accounts opened","Accounts created from verified opening Orders.",["account","order"],{valueStatus:"verified"}),
  metric("commission_payment_reliability","Commission payment reliability","Paid Commissions on or before due date ÷ paid Commissions with a documented due date.",["commission"]),
  metric("dispute_frequency","Dispute frequency","Commissions with a Dispute ÷ all Commissions.",["commission","commission_dispute"]),
  metric("authority_expiration_risk","Authority expiration exposure","Active Agreements expiring within 60 days.",["representation_agreement"]),
  metric("contactability","Contactability","Verified professional Contacts not actively suppressed ÷ Contacts in contacted Businesses.",["contact","communication_suppression"]),
  metric("opening_order_rate","Opening-order rate","Businesses with a verified opening Order ÷ Businesses contacted.",["business","outreach_message","order"],{valueStatus:"verified"}),
  metric("average_order_value","Average order value","Verified net commissionable Order value ÷ verified Orders, by currency.",["order"],{currencyBehavior:separateCurrency,valueStatus:"verified"}),
  metric("stage_distribution","Stage distribution","Count of current Placement Opportunities by stage.",["placement_opportunity"]),
  metric("stage_conversion","Stage conversion","Distinct Opportunities entering a later stage ÷ distinct Opportunities entering the starting stage.",["placement_stage_event"]),
  metric("time_in_stage","Time in stage","Days since the latest stage-entry event for open Placement Opportunities.",["placement_opportunity","placement_stage_event"]),
  metric("portfolio_brand_concentration","Brand concentration","Largest Brand share of verified net wholesale value, shown with contributing values.",["order","brand"],{currencyBehavior:separateCurrency,valueStatus:"verified"}),
  metric("portfolio_product_concentration","Product concentration","Largest Product share of verified line-item net commissionable value.",["order_line_item","product"],{currencyBehavior:separateCurrency,valueStatus:"verified"}),
  metric("portfolio_account_concentration","Account concentration","Largest Account share of verified net wholesale value.",["order","account"],{currencyBehavior:separateCurrency,valueStatus:"verified"}),
  metric("commission_concentration","Commission concentration","Largest Brand share of paid Commission, by currency.",["commission","brand"],{currencyBehavior:separateCurrency}),
  metric("recurring_vs_opening_commission","Recurring versus opening-order commission","Expected/approved/paid Commission separated by opening-order and reorder term type.",["commission"],{currencyBehavior:separateCurrency,valueStatus:"mixed"}),
  metric("active_vs_inactive_accounts","Active versus inactive accounts","Account count grouped by current status and health.",["account"]),
  metric("overdue_reorders","Overdue reorders","Open projected/due Reorders past the expected window end.",["reorder"],{valueStatus:"projected"}),
  metric("relationship_risk","Relationship risk indicators","Count of open high/critical risks, at-risk Accounts, and suspended/expiring authority.",["risk_flag","account","representation_agreement"]),
  metric("territory_concentration","Territory concentration","Active Agreements grouped by explicit stored territory scope.",["representation_agreement"],{
    knownLimitations:"Territory scope is contractual context; no demand or demographic inference is made."
  }),
  metric("evidence_freshness","Evidence freshness","Current evidence grouped as current, due for reassessment, or stale.",["evidence_record"]),
  metric("risk_trends","Risk trends","Open and resolved Risk Flags by creation/resolution period and severity.",["risk_flag"]),
  metric("payment_timeliness","Payment timeliness","Days between documented Commission due date and evidence-confirmed payment date.",["commission"]),
  metric("historical_run_rate","Historical run-rate summary","Verified order or paid Commission actuals in the selected historical period; no extrapolation.",["order","commission"],{currencyBehavior:separateCurrency,valueStatus:"verified"})
];

export const metricByCode = new Map(metricDictionary.map((definition) => [definition.code, definition]));

export type AnalyticsFilters = {
  from?: string | undefined;
  to?: string | undefined;
  brandId?: string | undefined;
  productId?: string | undefined;
  businessId?: string | undefined;
  stage?: string | undefined;
  channel?: string | undefined;
  currency?: string | undefined;
};

function period(filters: AnalyticsFilters): { from: string; to: string } {
  const to = filters.to ?? new Date().toISOString().slice(0, 10);
  const from = filters.from ?? new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

type CountRow = Record<string, string | number | null>;

export async function getAnalyticsDashboard(
  database: Database | Transaction,
  workspaceId: string,
  filters: AnalyticsFilters
): Promise<Record<string, unknown>> {
  const selected = period(filters);
  const [
    outreachResult, pipelineResult, orderResult, commissionResult, accountResult,
    stageResult, productResult, brandResult, buyerResult, riskResult, externalResult,
    forecastResult
  ] = await Promise.all([
    database.query<CountRow>(
      `SELECT
         count(*) FILTER (WHERE m.direction='outbound')::int AS outreach_volume,
         count(*) FILTER (WHERE m.direction='outbound' AND m.approval_id IS NOT NULL)::int AS approved_messages,
         count(*) FILTER (WHERE m.direction='outbound' AND m.status IN ('accepted','delivered','replied'))::int AS sent_messages,
         count(*) FILTER (WHERE m.direction='outbound' AND m.status IN ('delivered','replied'))::int AS delivered,
         count(*) FILTER (WHERE m.direction='outbound' AND m.status='bounced')::int AS bounced,
         count(*) FILTER (WHERE m.direction='outbound' AND m.replied_at IS NOT NULL)::int AS replied,
         count(*) FILTER (WHERE m.direction='outbound' AND m.response_classification='interested')::int AS positive,
         count(*) FILTER (WHERE m.direction='outbound' AND m.response_classification IS NOT NULL)::int AS classified,
         count(*) FILTER (WHERE m.direction='outbound' AND m.response_classification IN ('interested','question','objection'))::int AS conversation,
         count(*) FILTER (WHERE m.direction='outbound' AND EXISTS (
           SELECT 1 FROM outreach_provider_events pe
            WHERE pe.provider_message_id=m.provider_message_id AND pe.event_type='complained'
         ))::int AS complained,
         count(*) FILTER (WHERE m.direction='outbound' AND (
           EXISTS (SELECT 1 FROM outreach_provider_events pe
                    WHERE pe.provider_message_id=m.provider_message_id AND pe.event_type='opted_out')
           OR EXISTS (SELECT 1 FROM communication_suppressions s
                       WHERE s.workspace_id=m.workspace_id AND s.contact_id=m.contact_id
                         AND s.status='active' AND s.reason='opt_out')
         ))::int AS opted_out
       FROM outreach_messages m
       WHERE m.workspace_id=$1 AND m.created_at::date BETWEEN $2::date AND $3::date
         AND ($4::uuid IS NULL OR m.brand_id=$4) AND ($5::uuid IS NULL OR m.business_id=$5)
         AND ($6::text IS NULL OR m.channel=$6)
         AND ($7::uuid IS NULL OR EXISTS (
           SELECT 1 FROM outreach_message_products mp
            WHERE mp.workspace_id=m.workspace_id AND mp.message_id=m.id AND mp.product_id=$7
         ))`, [workspaceId,selected.from,selected.to,filters.brandId??null,
          filters.businessId??null,filters.channel??null,filters.productId??null]
    ),
    database.query<CountRow>(
      `SELECT
         count(*) FILTER (WHERE p.stage NOT IN ('closed_lost','disqualified'))::int AS active,
         count(*) FILTER (WHERE p.stage='closed_lost')::int AS lost,
         count(*) FILTER (WHERE p.stage='disqualified')::int AS disqualified,
         count(*) FILTER (WHERE p.stage IN ('active_account','reorder_management'))::int AS won,
         count(*) FILTER (WHERE p.stage NOT IN ('closed_lost','disqualified')
           AND (t.id IS NULL OR t.status IN ('completed','canceled')))::int AS lacking_next_action,
         count(*) FILTER (WHERE p.stage NOT IN ('closed_lost','disqualified')
           AND (t.id IS NULL OR (t.status NOT IN ('completed','canceled') AND t.due_at<now())
                OR p.last_meaningful_action_at<now()-interval '14 days'))::int AS stalled,
         count(*) FILTER (WHERE p.conflict_status='blocked')::int AS blocked
       FROM placement_opportunities p
       LEFT JOIN tasks t ON t.workspace_id=p.workspace_id AND t.id=p.next_action_task_id
       WHERE p.workspace_id=$1 AND p.archived_at IS NULL
         AND p.created_at::date <= $2::date
         AND ($3::uuid IS NULL OR p.brand_id=$3) AND ($4::uuid IS NULL OR p.business_id=$4)
         AND ($5::text IS NULL OR p.stage=$5)
         AND ($6::uuid IS NULL OR EXISTS (
           SELECT 1 FROM placement_opportunity_products pp
            WHERE pp.workspace_id=p.workspace_id AND pp.placement_opportunity_id=p.id
              AND pp.product_id=$6
         ))`, [workspaceId,selected.to,filters.brandId??null,filters.businessId??null,
          filters.stage??null,filters.productId??null]
    ),
    database.query<CountRow>(
      `SELECT currency,
         count(*) FILTER (WHERE verification_status='verified' AND order_type='opening_order')::int AS opening_count,
         count(*) FILTER (WHERE verification_status='verified' AND order_type='reorder')::int AS reorder_count,
         coalesce(sum(wholesale_gross) FILTER (WHERE verification_status='verified'),0)::text AS gross,
         coalesce(sum(discounts) FILTER (WHERE verification_status='verified'),0)::text AS discounts,
         coalesce(sum(returns) FILTER (WHERE verification_status='verified'),0)::text AS returns,
         coalesce(sum(cancellations) FILTER (WHERE verification_status='verified'),0)::text AS cancellations,
         coalesce(sum(net_commissionable) FILTER (WHERE verification_status='verified'),0)::text AS verified,
         coalesce(sum(net_commissionable) FILTER (WHERE verification_status='verified' AND order_type='opening_order'),0)::text AS opening_value,
         coalesce(sum(net_commissionable) FILTER (WHERE verification_status='verified' AND order_type='reorder'),0)::text AS reorder_value
       FROM orders
       WHERE workspace_id=$1 AND archived_at IS NULL AND order_date BETWEEN $2::date AND $3::date
         AND ($4::uuid IS NULL OR brand_id=$4) AND ($5::uuid IS NULL OR business_id=$5)
         AND ($6::text IS NULL OR currency=$6)
         AND ($7::uuid IS NULL OR EXISTS (
           SELECT 1 FROM order_line_items li WHERE li.workspace_id=orders.workspace_id
             AND li.order_id=orders.id AND li.product_id=$7
         ))
       GROUP BY currency ORDER BY currency`, [workspaceId,selected.from,selected.to,
        filters.brandId??null,filters.businessId??null,filters.currency??null,filters.productId??null]
    ),
    database.query<CountRow>(
      `SELECT c.currency,
         coalesce(sum(coalesce(cc.result_amount,c.expected_amount)),0)::text AS expected,
         coalesce(sum(c.approved_amount),0)::text AS approved,
         coalesce(sum(c.approved_amount) FILTER (WHERE c.status='payable'),0)::text AS payable,
         coalesce(sum(c.paid_amount),0)::text AS paid,
         coalesce(sum(d.disputed_amount) FILTER (WHERE d.status NOT IN ('resolved','rejected','withdrawn')),0)::text AS disputed,
         coalesce(sum(coalesce(c.approved_amount,c.expected_amount)) FILTER (
           WHERE c.status IN ('approved','payable','disputed') AND c.payment_due_date<current_date
         ),0)::text AS overdue,
         coalesce(sum(c.clawback_amount) FILTER (WHERE c.clawback_status='applied'),0)::text AS clawbacks
       FROM commissions c
       LEFT JOIN commission_calculations cc
         ON cc.workspace_id=c.workspace_id AND cc.id=c.current_calculation_id
       LEFT JOIN commission_disputes d ON d.workspace_id=c.workspace_id AND d.commission_id=c.id
       WHERE c.workspace_id=$1 AND c.archived_at IS NULL
         AND c.created_at::date BETWEEN $2::date AND $3::date
         AND ($4::uuid IS NULL OR c.brand_id=$4) AND ($5::text IS NULL OR c.currency=$5)
         AND ($6::uuid IS NULL OR EXISTS (
           SELECT 1 FROM accounts a WHERE a.workspace_id=c.workspace_id AND a.id=c.account_id
             AND a.business_id=$6
         ))
       GROUP BY c.currency ORDER BY c.currency`, [workspaceId,selected.from,selected.to,
        filters.brandId??null,filters.currency??null,filters.businessId??null]
    ),
    database.query<CountRow>(
      `SELECT
         count(*) FILTER (WHERE a.status IN ('onboarding','active','at_risk','paused'))::int AS active_accounts,
         count(*) FILTER (WHERE a.health IN ('watch','at_risk','inactive'))::int AS at_risk_accounts,
         count(*) FILTER (WHERE r.status IN ('projected','due','contacted')
           AND r.expected_window_starts_on<=current_date+30)::int AS upcoming_reorders,
         count(*) FILTER (WHERE r.status IN ('projected','due','contacted')
           AND r.expected_window_ends_on<current_date)::int AS overdue_reorders
       FROM accounts a LEFT JOIN reorders r ON r.workspace_id=a.workspace_id AND r.account_id=a.id
       WHERE a.workspace_id=$1 AND a.archived_at IS NULL
         AND ($2::uuid IS NULL OR a.brand_id=$2) AND ($3::uuid IS NULL OR a.business_id=$3)`,
      [workspaceId,filters.brandId??null,filters.businessId??null]
    ),
    database.query<CountRow>(
      `SELECT stage,count(*)::int AS count,
         round(avg(extract(epoch FROM (now()-last_meaningful_action_at))/86400),1)::text AS average_age_days
       FROM placement_opportunities
       WHERE workspace_id=$1 AND archived_at IS NULL
         AND ($2::uuid IS NULL OR brand_id=$2) AND ($3::uuid IS NULL OR business_id=$3)
       GROUP BY stage ORDER BY count DESC`, [workspaceId,filters.brandId??null,filters.businessId??null]
    ),
    database.query<CountRow>(
      `SELECT p.id,p.name,b.public_name AS brand_name,
         coalesce(pop.opportunities,0)::int AS opportunities,
         coalesce(commercial.verified_orders,0)::int AS verified_orders,
         coalesce(commercial.verified_value,0)::text AS verified_value,
         coalesce(evidence.stale_evidence,0)::int AS stale_evidence
       FROM products p JOIN brands b ON b.workspace_id=p.workspace_id AND b.id=p.brand_id
       LEFT JOIN LATERAL (
         SELECT count(DISTINCT link.placement_opportunity_id)::int AS opportunities
           FROM placement_opportunity_products link
          WHERE link.workspace_id=p.workspace_id AND link.product_id=p.id
       ) pop ON true
       LEFT JOIN LATERAL (
         SELECT count(DISTINCT o.id) FILTER (WHERE o.verification_status='verified')::int AS verified_orders,
                coalesce(sum(li.net_commissionable) FILTER (WHERE o.verification_status='verified'),0) AS verified_value
           FROM order_line_items li
           JOIN orders o ON o.workspace_id=li.workspace_id AND o.id=li.order_id
          WHERE li.workspace_id=p.workspace_id AND li.product_id=p.id
       ) commercial ON true
       LEFT JOIN LATERAL (
         SELECT count(*) FILTER (WHERE e.status='stale' OR e.reassess_at<now())::int AS stale_evidence
           FROM evidence_records e
          WHERE e.workspace_id=p.workspace_id AND e.subject_type='product' AND e.subject_id=p.id
       ) evidence ON true
       WHERE p.workspace_id=$1 AND p.archived_at IS NULL AND ($2::uuid IS NULL OR p.brand_id=$2)
         AND ($3::uuid IS NULL OR p.id=$3)
       ORDER BY coalesce(commercial.verified_value,0) DESC,p.name
       LIMIT 100`,
      [workspaceId,filters.brandId??null,filters.productId??null]
    ),
    database.query<CountRow>(
      `SELECT b.id,b.public_name AS name,
         coalesce(authority.active_agreements,0)::int AS active_agreements,
         coalesce(account_totals.active_accounts,0)::int AS active_accounts,
         coalesce(commercial.verified_orders,0)::int AS verified_orders,
         coalesce(commercial.verified_value,0)::text AS verified_value,
         coalesce(commission_totals.overdue_commissions,0)::int AS overdue_commissions,
         coalesce(commission_totals.open_disputes,0)::int AS open_disputes
       FROM brands b
       LEFT JOIN LATERAL (
         SELECT count(*) FILTER (WHERE a.status='active')::int AS active_agreements
           FROM representation_agreements a
          WHERE a.workspace_id=b.workspace_id AND a.brand_id=b.id AND a.archived_at IS NULL
       ) authority ON true
       LEFT JOIN LATERAL (
         SELECT count(*) FILTER (WHERE ac.status<>'ended')::int AS active_accounts
           FROM accounts ac
          WHERE ac.workspace_id=b.workspace_id AND ac.brand_id=b.id AND ac.archived_at IS NULL
       ) account_totals ON true
       LEFT JOIN LATERAL (
         SELECT count(*) FILTER (WHERE o.verification_status='verified')::int AS verified_orders,
                coalesce(sum(o.net_commissionable) FILTER (WHERE o.verification_status='verified'),0) AS verified_value
           FROM orders o
          WHERE o.workspace_id=b.workspace_id AND o.brand_id=b.id AND o.archived_at IS NULL
       ) commercial ON true
       LEFT JOIN LATERAL (
         SELECT count(DISTINCT c.id) FILTER (
                  WHERE c.payment_due_date<current_date AND c.status IN ('approved','payable','disputed')
                )::int AS overdue_commissions,
                count(DISTINCT d.id) FILTER (
                  WHERE d.status NOT IN ('resolved','rejected','withdrawn')
                )::int AS open_disputes
           FROM commissions c
           LEFT JOIN commission_disputes d
             ON d.workspace_id=c.workspace_id AND d.commission_id=c.id AND d.archived_at IS NULL
          WHERE c.workspace_id=b.workspace_id AND c.brand_id=b.id AND c.archived_at IS NULL
       ) commission_totals ON true
       WHERE b.workspace_id=$1 AND b.archived_at IS NULL AND ($2::uuid IS NULL OR b.id=$2)
       ORDER BY coalesce(commercial.verified_value,0) DESC,b.public_name
       LIMIT 100`,
      [workspaceId,filters.brandId??null]
    ),
    database.query<CountRow>(
      `SELECT b.id,b.name,b.business_type,
         coalesce(outreach.outreach,0)::int AS outreach,
         coalesce(outreach.replies,0)::int AS replies,
         coalesce(commercial.opening_orders,0)::int AS opening_orders,
         coalesce(commercial.reorders,0)::int AS reorders,
         coalesce(commercial.verified_value,0)::text AS verified_value
       FROM businesses b
       LEFT JOIN LATERAL (
         SELECT count(*) FILTER (WHERE m.direction='outbound')::int AS outreach,
                count(*) FILTER (WHERE m.replied_at IS NOT NULL)::int AS replies
           FROM outreach_messages m
          WHERE m.workspace_id=b.workspace_id AND m.business_id=b.id
       ) outreach ON true
       LEFT JOIN LATERAL (
         SELECT count(*) FILTER (
                  WHERE o.verification_status='verified' AND o.order_type='opening_order'
                )::int AS opening_orders,
                count(*) FILTER (
                  WHERE o.verification_status='verified' AND o.order_type='reorder'
                )::int AS reorders,
                coalesce(sum(o.net_commissionable) FILTER (WHERE o.verification_status='verified'),0) AS verified_value
           FROM orders o
          WHERE o.workspace_id=b.workspace_id AND o.business_id=b.id AND o.archived_at IS NULL
       ) commercial ON true
       WHERE b.workspace_id=$1 AND b.archived_at IS NULL AND ($2::uuid IS NULL OR b.id=$2)
       ORDER BY coalesce(commercial.verified_value,0) DESC,b.name
       LIMIT 100`,
      [workspaceId,filters.businessId??null]
    ),
    database.query<CountRow>(
      `SELECT
         count(*) FILTER (WHERE status IN ('open','reviewing') AND severity IN ('high','critical'))::int AS high_open_risks,
         count(*) FILTER (WHERE status IN ('open','reviewing'))::int AS open_risks
       FROM risk_flags WHERE workspace_id=$1`, [workspaceId]
    ),
    database.query<CountRow>(
      `SELECT count(*)::int AS count,max(observed_at) AS latest
         FROM external_metric_observations WHERE workspace_id=$1 AND status='current'`, [workspaceId]
    ),
    database.query<CountRow>(
      `SELECT id,target_type,target_id,currency,low_amount::text AS low_amount,
              base_amount::text AS base_amount,high_amount::text AS high_amount,
              qualitative_likelihood,horizon_starts_on,horizon_ends_on,evidence_ids,
              assumptions,limitations,method,status,updated_at
         FROM analytics_forecasts WHERE workspace_id=$1 AND status='current'
         ORDER BY horizon_ends_on LIMIT 100`, [workspaceId]
    )
  ]);
  const outreach = outreachResult.rows[0] ?? {};
  const sent = Number(outreach.sent_messages ?? 0);
  const classified = Number(outreach.classified ?? 0);
  const openingOrderCount = orderResult.rows.reduce((total,row)=>total+Number(row.opening_count??0),0);
  const reorderCount = orderResult.rows.reduce((total,row)=>total+Number(row.reorder_count??0),0);
  const metrics = {
    ...outreach,
    delivery_rate: rate(Number(outreach.delivered ?? 0), sent),
    bounce_rate: rate(Number(outreach.bounced ?? 0), sent),
    complaint_rate: rate(Number(outreach.complained ?? 0), sent),
    opt_out_rate: rate(Number(outreach.opted_out ?? 0), sent),
    reply_rate: rate(Number(outreach.replied ?? 0), sent),
    positive_response_rate: rate(Number(outreach.positive ?? 0), classified),
    conversation_rate: rate(Number(outreach.conversation ?? 0), sent),
    ...pipelineResult.rows[0],
    ...accountResult.rows[0],
    ...riskResult.rows[0],
    opening_order_count: openingOrderCount,
    reorder_count: reorderCount,
    active_placement_opportunities: pipelineResult.rows[0]?.active ?? 0,
    opportunities_won: pipelineResult.rows[0]?.won ?? 0,
    opportunities_lost: pipelineResult.rows[0]?.lost ?? 0,
    stalled_opportunities: pipelineResult.rows[0]?.stalled ?? 0,
    opportunities_lacking_next_action: pipelineResult.rows[0]?.lacking_next_action ?? 0,
    blocked_opportunities: pipelineResult.rows[0]?.blocked ?? 0
  };
  return {
    generatedAt: new Date().toISOString(),
    period: selected,
    filters,
    partialData: false,
    externalIntelligence: {
      status: Number(externalResult.rows[0]?.count ?? 0) > 0 ? "connected_records_available" : "not_connected",
      observationCount: Number(externalResult.rows[0]?.count ?? 0),
      latestObservationAt: externalResult.rows[0]?.latest ?? null,
      message: Number(externalResult.rows[0]?.count ?? 0) > 0
        ? "Only stored, provenance-linked observations are included."
        : "No verified external intelligence is connected. No zero or synthetic value is displayed."
    },
    metrics,
    currencyTotals: {
      orders: orderResult.rows,
      commissions: commissionResult.rows
    },
    stageDistribution: stageResult.rows,
    products: productResult.rows,
    brands: brandResult.rows,
    buyers: buyerResult.rows,
    forecasts: forecastResult.rows,
    definitions: metricDictionary
  };
}

type PriorityItem = {
  key: string;
  itemType: string;
  itemId: string;
  title: string;
  reason: string;
  explanation: string[];
  baseRank: number;
  priority: string;
  dueAt: string | null;
  targetType: string;
  targetId: string;
  href: string;
  nextAction: string;
  blocking: boolean;
};

function hrefFor(type: string, id: string): string {
  const paths: Record<string,string> = {
    task: "/tasks",
    placement_opportunity: `/placements/${id}`,
    representation_agreement: `/agreements/${id}`,
    reorder: "/reorders",
    commission: `/commissions/${id}`,
    commission_dispute: `/commission-disputes/${id}`,
    outreach_message: `/outreach/${id}`,
    evidence_record: "/sources",
    risk_flag: "/tasks",
    protected_account: `/protected-accounts/${id}`,
    product: `/products/${id}`,
    brand: `/brands/${id}`,
    business: `/buyers/${id}`,
    account: `/accounts/${id}`,
    order: `/orders/${id}`
  };
  return paths[type] ?? "/search";
}

export async function getHomeCommandCenter(
  database: Database,
  workspaceId: string,
  userId: string,
  options: {priorityLimit?:number} = {}
): Promise<Record<string, unknown>> {
  const state = await database.query<{ last: string }>(
    `SELECT last_acknowledged_at AS last FROM home_user_states
      WHERE workspace_id=$1 AND user_id=$2`, [workspaceId,userId]
  );
  const changedSince = state.rows[0]?.last ?? new Date(Date.now()-7*86_400_000).toISOString();
  const [tasks, agreements, placements, reorders, commissions, disputes, messages, evidence, risks, protections, actions, changes, analytics] =
    await Promise.all([
      database.query<CountRow>(
        `SELECT id,title,priority,due_at AS "dueAt",mandatory_gate AS "mandatoryGate",
                subject_type AS "subjectType",subject_id AS "subjectId",created_reason AS reason
           FROM tasks WHERE workspace_id=$1 AND owner_user_id=$2
            AND status IN ('open','in_progress','blocked')`, [workspaceId,userId]
      ),
      database.query<CountRow>(
        `SELECT id,status,expires_at AS "dueAt",legal_ambiguity_status AS ambiguity
           FROM representation_agreements WHERE workspace_id=$1 AND archived_at IS NULL
            AND (status IN ('reviewing','pending_approval','suspended','expired')
              OR legal_ambiguity_status IN ('review_required','specialist_required')
              OR (status='active' AND expires_at<now()+interval '60 days'))`, [workspaceId]
      ),
      database.query<CountRow>(
        `SELECT p.id,p.stage,p.last_meaningful_action_at AS "lastAction",
                p.conflict_status AS conflict,t.id AS "taskId",t.due_at AS "dueAt",t.status AS "taskStatus",
                br.public_name AS "brandName",b.name AS "businessName"
           FROM placement_opportunities p
           JOIN brands br ON br.workspace_id=p.workspace_id AND br.id=p.brand_id
           JOIN businesses b ON b.workspace_id=p.workspace_id AND b.id=p.business_id
           LEFT JOIN tasks t ON t.workspace_id=p.workspace_id AND t.id=p.next_action_task_id
          WHERE p.workspace_id=$1 AND p.archived_at IS NULL
            AND p.stage NOT IN ('closed_lost','disqualified')`, [workspaceId]
      ),
      database.query<CountRow>(
        `SELECT r.id,r.status,r.reminder_at AS "dueAt",r.expected_window_starts_on AS "windowStart",
                r.expected_window_ends_on AS "windowEnd",r.next_action AS "nextAction",a.health,
                b.name AS "businessName"
           FROM reorders r JOIN accounts a ON a.workspace_id=r.workspace_id AND a.id=r.account_id
           JOIN businesses b ON b.workspace_id=a.workspace_id AND b.id=a.business_id
          WHERE r.workspace_id=$1 AND r.archived_at IS NULL
            AND r.status IN ('projected','due','contacted')
            AND (r.reminder_at<=now()+interval '30 days' OR r.expected_window_starts_on<=current_date+30)`, [workspaceId]
      ),
      database.query<CountRow>(
        `SELECT id,status,payment_due_date AS "dueAt",currency,
                coalesce(approved_amount,expected_amount)::text AS amount
           FROM commissions WHERE workspace_id=$1 AND archived_at IS NULL
            AND status IN ('approved','payable','disputed')
            AND payment_due_date<=current_date`, [workspaceId]
      ),
      database.query<CountRow>(
        `SELECT id,status,updated_at AS "dueAt",reason,next_action AS "nextAction"
           FROM commission_disputes WHERE workspace_id=$1 AND archived_at IS NULL
            AND status NOT IN ('resolved','rejected','withdrawn')`, [workspaceId]
      ),
      database.query<CountRow>(
        `SELECT id,status,created_at AS "dueAt",response_classification AS classification,
                direction FROM outreach_messages WHERE workspace_id=$1
            AND ((direction='inbound' AND response_classification IS NULL)
              OR status='approval_requested')`, [workspaceId]
      ),
      database.query<CountRow>(
        `SELECT id,subject_type AS "subjectType",subject_id AS "subjectId",exact_claim,
                reassess_at AS "dueAt",status FROM evidence_records WHERE workspace_id=$1
            AND (status='stale' OR (status='current' AND reassess_at<=now()))`, [workspaceId]
      ),
      database.query<CountRow>(
        `SELECT id,risk_type,severity,due_at AS "dueAt",description FROM risk_flags
          WHERE workspace_id=$1 AND status IN ('open','reviewing')`, [workspaceId]
      ),
      database.query<CountRow>(
        `SELECT id,status,protection_ends_on AS "dueAt",scope_summary
           FROM protected_accounts WHERE workspace_id=$1 AND archived_at IS NULL
            AND status IN ('active','expiring','disputed')
            AND (status='disputed' OR protection_ends_on<=current_date+60)`, [workspaceId]
      ),
      database.query<CountRow>(
        `SELECT DISTINCT ON(item_type,item_id) item_type,item_id,action,reason,
                snoozed_until,manual_priority,created_at
           FROM home_priority_actions WHERE workspace_id=$1 AND user_id=$2
          ORDER BY item_type,item_id,created_at DESC`, [workspaceId,userId]
      ),
      database.query<CountRow>(
        `SELECT action,target_type AS "targetType",target_id AS "targetId",
                occurred_at AS "occurredAt",outcome
           FROM audit_events WHERE workspace_id=$1 AND occurred_at>$2
            AND outcome='succeeded'
            AND target_type IN (
              'outreach_message','placement_opportunity','representation_agreement',
              'authority_evaluation','order','commission','commission_dispute',
              'account','evidence_record','ai_suggestion'
            )
            AND action !~ '(viewed|listed|searched|session)'
          ORDER BY occurred_at DESC LIMIT 50`, [workspaceId,changedSince]
      ),
      getAnalyticsDashboard(database,workspaceId,{})
    ]);
  const now = Date.now();
  const items: PriorityItem[] = [];
  const add = (item: Omit<PriorityItem,"key"|"href">) => items.push({
    ...item,key:`${item.itemType}:${item.itemId}`,href:hrefFor(item.targetType,item.targetId)
  });
  for (const row of tasks.rows) {
    const due = row.dueAt ? new Date(String(row.dueAt)).getTime() : null;
    const overdueDays = due && due < now ? Math.floor((now-due)/86_400_000)+1 : 0;
    add({
      itemType:"task",itemId:String(row.id),targetType:String(row.subjectType),
      targetId:String(row.subjectId),title:String(row.title),reason:String(row.reason),
      explanation:[
        row.mandatoryGate ? "This is a mandatory human-controlled gate." : "This is an owned commitment.",
        overdueDays ? `It is ${overdueDays} day${overdueDays===1?"":"s"} overdue.` : due ? "Its due date is approaching." : "It has no due date."
      ],
      baseRank:row.mandatoryGate?5:overdueDays?15:35,priority:String(row.priority),
      dueAt:row.dueAt?String(row.dueAt):null,nextAction:"Open or complete the task.",
      blocking:Boolean(row.mandatoryGate)
    });
  }
  for (const row of agreements.rows) add({
    itemType:"representation_agreement",itemId:String(row.id),targetType:"representation_agreement",
    targetId:String(row.id),title:"Representation authority requires review",
    reason:`Agreement is ${String(row.status).replaceAll("_"," ")}; legal ambiguity is ${String(row.ambiguity).replaceAll("_"," ")}.`,
    explanation:["Authority and trust blockers take precedence over commercial work."],
    baseRank:2,priority:"critical",dueAt:row.dueAt?String(row.dueAt):null,
    nextAction:"Review the Agreement and human authority decision.",blocking:true
  });
  for (const row of placements.rows) {
    const stalled = !row.taskId || (row.dueAt && new Date(String(row.dueAt)).getTime()<now) ||
      new Date(String(row.lastAction)).getTime()<now-14*86_400_000;
    if (!stalled && row.conflict!=="blocked") continue;
    add({
      itemType:"placement_opportunity",itemId:String(row.id),targetType:"placement_opportunity",
      targetId:String(row.id),title:`${String(row.brandName)} → ${String(row.businessName)}`,
      reason:row.conflict==="blocked"?"An unresolved conflict blocks progress.":"The opportunity is stalled or lacks a current next action.",
      explanation:[row.conflict==="blocked"?"Conflict protection is a mandatory gate.":"No meaningful movement or next-action coverage is visible."],
      baseRank:row.conflict==="blocked"?3:60,priority:row.conflict==="blocked"?"critical":"medium",
      dueAt:row.dueAt?String(row.dueAt):null,nextAction:"Review the Placement and record the next human-owned action.",
      blocking:row.conflict==="blocked"
    });
  }
  for (const row of reorders.rows) add({
    itemType:"reorder",itemId:String(row.id),targetType:"reorder",targetId:String(row.id),
    title:`Reorder review: ${String(row.businessName)}`,reason:`The recorded reorder window is approaching; Account health is ${row.health}.`,
    explanation:["This is a recorded window, not a predicted purchase.","External contact still requires Phase 4 authority and Phase 5 approval."],
    baseRank:40,priority:"high",dueAt:row.dueAt?String(row.dueAt):row.windowStart?String(row.windowStart):null,
    nextAction:String(row.nextAction || "Review Account and reorder evidence."),blocking:false
  });
  for (const row of commissions.rows) add({
    itemType:"commission",itemId:String(row.id),targetType:"commission",targetId:String(row.id),
    title:`Commission ${String(row.status).replaceAll("_"," ")}`,
    reason:`${row.currency} ${row.amount} has reached or passed its documented due date.`,
    explanation:["The amount comes from the current explainable Phase 6 record.","Payment state requires documentary human confirmation."],
    baseRank:30,priority:"high",dueAt:row.dueAt?String(row.dueAt):null,
    nextAction:"Review payment evidence or open/update a dispute.",blocking:false
  });
  for (const row of disputes.rows) add({
    itemType:"commission_dispute",itemId:String(row.id),targetType:"commission_dispute",targetId:String(row.id),
    title:"Open Commission dispute",reason:String(row.reason),
    explanation:["Unresolved disputes preserve chronology and require a named human next action."],
    baseRank:12,priority:"critical",dueAt:row.dueAt?String(row.dueAt):null,
    nextAction:String(row.nextAction),blocking:true
  });
  for (const row of messages.rows) add({
    itemType:"outreach_message",itemId:String(row.id),targetType:"outreach_message",targetId:String(row.id),
    title:row.direction==="inbound"?"Buyer reply needs classification":"Message awaits human approval",
    reason:row.direction==="inbound"?"The provider-linked reply is not classified.":"No external send can occur until the exact message is approved.",
    explanation:["A time-sensitive human response is waiting."],baseRank:20,priority:"high",
    dueAt:row.dueAt?String(row.dueAt):null,nextAction:row.direction==="inbound"?"Classify the reply.":"Review the exact recipient and content.",
    blocking:false
  });
  for (const row of evidence.rows) add({
    itemType:"evidence_record",itemId:String(row.id),targetType:String(row.subjectType),targetId:String(row.subjectId),
    title:"Evidence requires verification",reason:String(row.exact_claim),
    explanation:["The evidence is stale or has reached its reassessment date."],baseRank:70,priority:"medium",
    dueAt:row.dueAt?String(row.dueAt):null,nextAction:"Replace, verify, or document a permitted exception.",blocking:false
  });
  for (const row of risks.rows) add({
    itemType:"risk_flag",itemId:String(row.id),targetType:"risk_flag",targetId:String(row.id),
    title:`${String(row.severity)} risk: ${String(row.risk_type).replaceAll("_"," ")}`,
    reason:String(row.description),explanation:["An unresolved recorded risk requires human review."],
    baseRank:["critical","high"].includes(String(row.severity))?8:65,priority:String(row.severity),
    dueAt:row.dueAt?String(row.dueAt):null,nextAction:"Review the risk and mitigation evidence.",
    blocking:row.severity==="critical"
  });
  for (const row of protections.rows) add({
    itemType:"protected_account",itemId:String(row.id),targetType:"protected_account",targetId:String(row.id),
    title:"Protected Account deadline",reason:row.status==="disputed"?"Protection is disputed.":"Written protection is approaching expiry.",
    explanation:["No continuing right is inferred beyond the documented term."],
    baseRank:row.status==="disputed"?4:25,priority:row.status==="disputed"?"critical":"high",
    dueAt:row.dueAt?String(row.dueAt):null,nextAction:"Review written scope, renewal, or release evidence.",
    blocking:row.status==="disputed"
  });
  const actionMap = new Map(actions.rows.map((row)=>[`${row.item_type}:${row.item_id}`,row]));
  const visible = items.filter((item)=>{
    const action = actionMap.get(item.key);
    if (!action) return true;
    if (action.action==="restored") return true;
    if (action.action==="snoozed" && action.snoozed_until && new Date(String(action.snoozed_until)).getTime()<=now) return true;
    return item.blocking || !["dismissed","completed","snoozed"].includes(String(action.action));
  }).map((item)=>{
    const action = actionMap.get(item.key);
    const manual = action?.manual_priority ? String(action.manual_priority) : null;
    const adjustment = manual ? {critical:-20,high:-10,medium:10,low:25}[manual] ?? 0 : 0;
    return {...item,priority:manual??item.priority,rank:item.baseRank+adjustment,
      explanation:manual?[...item.explanation,`You manually reprioritized this item to ${manual}.`]:item.explanation};
  }).sort((a,b)=>a.rank-b.rank || (a.dueAt??"9999").localeCompare(b.dueAt??"9999"));
  return {
    generatedAt:new Date().toISOString(),changedSince,
    priorities:visible.slice(0,options.priorityLimit??7),
    today:visible.filter((item)=>item.dueAt && new Date(item.dueAt).getTime()<=now+86_400_000),
    changes:changes.rows,
    pipeline:analytics.metrics,
    commercial:analytics.currencyTotals,
    emptyWorkspace:items.length===0 && changes.rows.length===0
  };
}

export async function acknowledgeHome(
  database: Database,
  input: {workspaceId:string;userId:string;requestId:string}
): Promise<void> {
  await database.query(
    `INSERT INTO home_user_states(workspace_id,user_id,last_acknowledged_at)
     VALUES($1,$2,now()) ON CONFLICT(workspace_id,user_id) DO UPDATE SET
       last_acknowledged_at=now(),version=home_user_states.version+1,updated_at=now()`,
    [input.workspaceId,input.userId]
  );
  await recordAudit(database,{
    workspaceId:input.workspaceId,actorUserId:input.userId,actorType:"user",
    action:"home.changes_acknowledged",targetType:"home_state",targetId:input.userId,
    origin:"api",requestId:input.requestId,outcome:"succeeded"
  });
}

export async function actOnPriority(
  database: Database,
  input: {
    workspaceId:string;userId:string;requestId:string;itemType:string;itemId:string;
    action:"completed"|"snoozed"|"dismissed"|"reprioritized"|"restored";
    reason:string;snoozedUntil?:string|null|undefined;manualPriority?:string|null|undefined;
  }
): Promise<void> {
  const blocking = ["representation_agreement","commission_dispute","protected_account"].includes(input.itemType);
  if (blocking && ["dismissed","completed"].includes(input.action)) {
    throw new AppError(409,"priority_blocker_requires_resolution","Critical blockers resolve only through their source workflow.");
  }
  await database.query(
    `INSERT INTO home_priority_actions
      (id,workspace_id,user_id,item_type,item_id,action,reason,snoozed_until,manual_priority,actor_user_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$3)`,
    [newId(),input.workspaceId,input.userId,input.itemType,input.itemId,input.action,
      input.reason,input.snoozedUntil??null,input.manualPriority??null]
  );
  await recordAudit(database,{
    workspaceId:input.workspaceId,actorUserId:input.userId,actorType:"user",
    action:`home.priority_${input.action}`,targetType:input.itemType,targetId:input.itemId,
    origin:"api",requestId:input.requestId,outcome:"succeeded",
    metadata:{reason:input.reason,snoozedUntil:input.snoozedUntil??null,manualPriority:input.manualPriority??null}
  });
}

export async function createAnalyticsForecast(
  database: Database,
  input: {
    workspaceId:string;userId:string;requestId:string;targetType:string;targetId:string;
    currency:string;lowAmount:string;baseAmount:string;highAmount:string;
    qualitativeLikelihood:string;horizonStartsOn:string;horizonEndsOn:string;
    evidenceIds:string[];assumptions:string[];limitations:string[];
  }
): Promise<Record<string,unknown>> {
  if (input.evidenceIds.length===0) {
    throw new AppError(422,"forecast_evidence_required","A projection requires at least one stored evidence record.");
  }
  const targetTables: Record<string,string> = {
    placement_opportunity:"placement_opportunities",account:"accounts",reorder:"reorders"
  };
  const table = targetTables[input.targetType];
  if (!table) throw new AppError(422,"forecast_target_invalid","Unsupported forecast target.");
  return withTransaction(database,async(transaction)=>{
    const target = await transaction.query(`SELECT id FROM ${table} WHERE workspace_id=$1 AND id=$2`,[input.workspaceId,input.targetId]);
    if (!target.rows[0]) throw new AppError(404,"forecast_target_not_found","Forecast target not found.");
    const evidence = await transaction.query(
      `SELECT id FROM evidence_records WHERE workspace_id=$1 AND id=ANY($2::uuid[])`,
      [input.workspaceId,input.evidenceIds]
    );
    if (evidence.rowCount!==input.evidenceIds.length) throw new AppError(422,"forecast_evidence_invalid","All forecast evidence must belong to this workspace.");
    await transaction.query(
      `UPDATE analytics_forecasts SET status='superseded',updated_at=now()
        WHERE workspace_id=$1 AND target_type=$2 AND target_id=$3 AND status='current'`,
      [input.workspaceId,input.targetType,input.targetId]
    );
    const id=newId();
    const result=await transaction.query<Record<string,unknown>>(
      `INSERT INTO analytics_forecasts
        (id,workspace_id,owner_user_id,target_type,target_id,currency,low_amount,base_amount,
         high_amount,qualitative_likelihood,horizon_starts_on,horizon_ends_on,evidence_ids,
         assumptions,limitations,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'current')
       RETURNING *`,[id,input.workspaceId,input.userId,input.targetType,input.targetId,input.currency,
        input.lowAmount,input.baseAmount,input.highAmount,input.qualitativeLikelihood,
        input.horizonStartsOn,input.horizonEndsOn,input.evidenceIds,input.assumptions,input.limitations]
    );
    await recordAudit(transaction,{
      workspaceId:input.workspaceId,actorUserId:input.userId,actorType:"user",
      action:"analytics.forecast_created",targetType:"analytics_forecast",targetId:id,
      origin:"api",requestId:input.requestId,outcome:"succeeded",after:result.rows[0]
    });
    return result.rows[0]!;
  });
}

export async function refreshAnalyticsAlerts(
  database: Database,
  input:{workspaceId:string;userId:string;requestId:string}
): Promise<{created:number}> {
  const home=await getHomeCommandCenter(
    database,input.workspaceId,input.userId,{priorityLimit:500}
  );
  const priorities=home.priorities as PriorityItem[];
  let created=0;
  for (const item of priorities) {
    const severity=item.blocking?"critical":item.priority==="high"?"action_required":"time_sensitive";
    const result=await database.query(
      `INSERT INTO notifications
        (id,workspace_id,user_id,notification_type,severity,title,reason,subject_type,
         subject_id,grouping_key,status,blocking,due_at)
       SELECT $1,$2,$3,'phase8_rule',$4,$5,$6,$7,
              CASE WHEN $8 ~ '^[0-9a-f-]{36}$' THEN $8::uuid ELSE NULL END,
              $9,'unread',$10,$11
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications WHERE workspace_id=$2 AND user_id=$3
          AND grouping_key=$9 AND status NOT IN ('resolved','archived','dismissed')
       )`,[newId(),input.workspaceId,input.userId,severity,item.title,item.reason,
        item.targetType,item.targetId,`phase8:${item.key}`,item.blocking,timestampValue(item.dueAt)]
    );
    created+=result.rowCount??0;
  }
  const outreachHealth=await database.query<{sent:number;bounced:number;complaints:number}>(
    `SELECT
       count(DISTINCT m.id) FILTER (WHERE m.status IN ('accepted','delivered','replied','bounced'))::int AS sent,
       count(DISTINCT m.id) FILTER (WHERE m.status='bounced')::int AS bounced,
       count(DISTINCT e.id) FILTER (WHERE e.event_type='complained')::int AS complaints
     FROM outreach_messages m
     LEFT JOIN outreach_provider_events e ON e.provider_message_id=m.provider_message_id
     WHERE m.workspace_id=$1 AND m.created_at>now()-interval '30 days'`,[input.workspaceId]
  );
  const health=outreachHealth.rows[0]??{sent:0,bounced:0,complaints:0};
  if(health.complaints>0 || (health.sent>=10 && health.bounced/health.sent>0.05)) {
    const result=await database.query(
      `INSERT INTO notifications
        (id,workspace_id,user_id,notification_type,severity,title,reason,grouping_key,status,blocking)
       SELECT $1,$2,$3,'outreach_health','action_required','Outreach health needs review',
              $4,'phase8:outreach-health','unread',false
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications WHERE workspace_id=$2 AND user_id=$3
          AND grouping_key='phase8:outreach-health' AND status NOT IN ('resolved','archived','dismissed')
       )`,[newId(),input.workspaceId,input.userId,
        `${health.bounced} of ${health.sent} recent accepted messages bounced; ${health.complaints} complaint event(s) are recorded.`]
    );
    created+=result.rowCount??0;
  }
  const credential=await database.query<{status:string;expiresAt:string|null}>(
    `SELECT status,expires_at AS "expiresAt" FROM certification_credentials
      WHERE user_id=$1 ORDER BY verified_at DESC NULLS LAST LIMIT 1`,[input.userId]
  );
  const credentialRow=credential.rows[0];
  if(credentialRow && (credentialRow.status!=="active" ||
    (credentialRow.expiresAt && new Date(credentialRow.expiresAt).getTime()<Date.now()+60*86_400_000))) {
    const result=await database.query(
      `INSERT INTO notifications
        (id,workspace_id,user_id,notification_type,severity,title,reason,grouping_key,status,blocking,due_at)
       SELECT $1,$2,$3,'credential_access','critical','Certification access needs attention',
              $4,'phase8:credential-access','unread',true,$5
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications WHERE workspace_id=$2 AND user_id=$3
          AND grouping_key='phase8:credential-access' AND status NOT IN ('resolved','archived')
       )`,[newId(),input.workspaceId,input.userId,
        `Credential status is ${credentialRow.status}; access controls remain authoritative.`,
        timestampValue(credentialRow.expiresAt)]
    );
    created+=result.rowCount??0;
  }
  await recordAudit(database,{
    workspaceId:input.workspaceId,actorUserId:input.userId,actorType:"job",
    action:"analytics.alerts_refreshed",targetType:"workspace",targetId:input.workspaceId,
    origin:"job",requestId:input.requestId,outcome:"succeeded",metadata:{created,ruleVersion:1}
  });
  return {created};
}

export async function scheduleDailyAnalyticsRefreshes(
  database:Database,
  runAt=new Date()
):Promise<number> {
  const memberships=await database.query<{workspaceId:string;userId:string}>(
    `SELECT workspace_id AS "workspaceId",user_id AS "userId"
       FROM workspace_memberships WHERE status='active' AND role='representative'`
  );
  const date=runAt.toISOString().slice(0,10);
  let inserted=0;
  for(const membership of memberships.rows) {
    const job=await enqueueJob(database,{
      workspaceId:membership.workspaceId,kind:"analytics.priority_refresh",
      payload:{userId:membership.userId},
      idempotencyKey:`analytics.priority-refresh:${membership.workspaceId}:${membership.userId}:${date}`,
      availableAt:runAt
    });
    if(job.inserted)inserted++;
  }
  return inserted;
}

export async function createReportDefinition(
  database:Database,
  input:{workspaceId:string;userId:string;requestId:string;name:string;reportType:string;filters:Record<string,unknown>;columns:string[]}
):Promise<Record<string,unknown>> {
  const id=newId();
  const result=await database.query<Record<string,unknown>>(
    `INSERT INTO analytics_report_definitions
      (id,workspace_id,owner_user_id,name,report_type,filters,columns,status)
     VALUES($1,$2,$3,$4,$5,$6,$7,'active') RETURNING *`,
    [id,input.workspaceId,input.userId,input.name,input.reportType,input.filters,input.columns]
  );
  await recordAudit(database,{workspaceId:input.workspaceId,actorUserId:input.userId,actorType:"user",
    action:"analytics.report_saved",targetType:"analytics_report",targetId:id,origin:"api",
    requestId:input.requestId,outcome:"succeeded",after:result.rows[0]});
  return result.rows[0]!;
}

function csvCell(value:unknown):string {
  const text=value==null?"":typeof value==="object"?JSON.stringify(value):
    typeof value==="string"||typeof value==="number"||typeof value==="boolean"?String(value):"";
  return `"${text.replaceAll('"','""')}"`;
}

export async function exportAnalyticsReport(
  database:Database,
  input:{workspaceId:string;userId:string;requestId:string;reportType:string;filters:AnalyticsFilters}
):Promise<{csv:string;runId:string}> {
  const data=await getAnalyticsDashboard(database,input.workspaceId,input.filters);
  const rows:unknown[][]=[["section","metric_or_currency","value","status","definition_version"]];
  const metrics=data.metrics as Record<string,unknown>;
  for(const [code,value] of Object.entries(metrics)) {
    if (metricByCode.has(code)) rows.push(["metric",code,value,metricByCode.get(code)!.valueStatus,1]);
  }
  const totals=data.currencyTotals as {orders:CountRow[];commissions:CountRow[]};
  for(const row of totals.orders) rows.push(["orders",row.currency,row,"verified",1]);
  for(const row of totals.commissions) rows.push(["commissions",row.currency,row,"mixed",1]);
  const csv=[
    `# report_type=${input.reportType}`,
    `# generated_at=${String(data.generatedAt)}`,
    `# filters=${JSON.stringify(input.filters)}`,
    `# currencies_are_separate=true`,
    ...rows.map((row)=>row.map(csvCell).join(","))
  ].join("\n");
  const runId=newId();
  const currencies=[...new Set([...totals.orders,...totals.commissions].map((row)=>String(row.currency)))];
  await database.query(
    `INSERT INTO analytics_report_runs
      (id,workspace_id,requested_by,report_type,filters,metric_definition_versions,
       currency_list,actual_estimate_labels,row_count,status)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'generated')`,
    [runId,input.workspaceId,input.userId,input.reportType,input.filters,
      Object.fromEntries(metricDictionary.map((item)=>[item.code,item.version])),
      currencies,["actual","verified","estimated","projected","approved","paid"],rows.length-1]
  );
  await recordAudit(database,{workspaceId:input.workspaceId,actorUserId:input.userId,actorType:"user",
    action:"analytics.export_generated",targetType:"analytics_report_run",targetId:runId,
    origin:"api",requestId:input.requestId,outcome:"succeeded",
    metadata:{reportType:input.reportType,filters:input.filters,currencies,rowCount:rows.length-1,digest:publicDigest(csv)}});
  return {csv,runId};
}

function numericTokens(value:string):string[] {
  return value.match(/-?\d+(?:\.\d+)?%?/g) ?? [];
}

function timestampValue(value: unknown): string | null {
  if (!value) return null;
  if (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number") return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function dateValue(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" || typeof value === "number") return String(value).slice(0, 10);
  return null;
}

export async function selectOutreachAnalyticsClaim(
  database:Database,
  input:{
    workspaceId:string;userId:string;requestId:string;messageId:string;metricCode:string;
    claimText:string;sourceRecordType:string;sourceRecordId:string;
    evidenceId?:string|null|undefined;externalObservationId?:string|null|undefined;
  }
):Promise<Record<string,unknown>> {
  return withTransaction(database,async(transaction)=>{
    const message=await transaction.query<{id:string;status:string}>(
      `SELECT id,status FROM outreach_messages WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId,input.messageId]
    );
    if(!message.rows[0]) throw new AppError(404,"outreach_message_not_found","Outreach message not found.");
    if(!["draft","approval_requested"].includes(String(message.rows[0].status))) {
      throw new AppError(409,"analytics_claim_message_locked","Analytics claims can be selected only while a message remains reviewable.");
    }
    let sourceText="";
    let periodStarts:string|null=null;
    let periodEnds:string|null=null;
    let freshnessAt:string|null=null;
    let freshnessStatus:"current"|"stale"|"unknown"="unknown";
    if(input.externalObservationId) {
      const observation=await transaction.query<CountRow>(
        `SELECT numeric_value::text AS value,unit,period_starts_on,period_ends_on,
                freshness_expires_at,status,verification_status
           FROM external_metric_observations
          WHERE workspace_id=$1 AND id=$2`,[input.workspaceId,input.externalObservationId]
      );
      const row=observation.rows[0];
      if(!row || row.verification_status!=="verified") {
        throw new AppError(422,"analytics_claim_source_unverified","External numerical claims require a verified stored observation.");
      }
      sourceText=`${row.value} ${row.unit}`;
      periodStarts=dateValue(row.period_starts_on);
      periodEnds=dateValue(row.period_ends_on);
      freshnessAt=timestampValue(row.freshness_expires_at);
      freshnessStatus=row.status==="current" && (!freshnessAt || new Date(freshnessAt)>new Date())?"current":"stale";
    } else if(input.evidenceId) {
      const evidence=await transaction.query<CountRow>(
        `SELECT exact_claim,observed_at,reassess_at,status,verification_status,evidence_class
           FROM evidence_records WHERE workspace_id=$1 AND id=$2 AND source_id IS NOT NULL`,
        [input.workspaceId,input.evidenceId]
      );
      const row=evidence.rows[0];
      if(!row || !["reviewed","verified"].includes(String(row.verification_status)) ||
        !["verified_fact","direct_evidence"].includes(String(row.evidence_class))) {
        throw new AppError(422,"analytics_claim_source_unverified","Numerical claims require reviewed Direct Evidence or a Verified Fact.");
      }
      sourceText=String(row.exact_claim);
      freshnessAt=timestampValue(row.reassess_at) ?? timestampValue(row.observed_at);
      freshnessStatus=row.status==="current" && (!row.reassess_at || new Date(String(row.reassess_at))>new Date())?"current":"stale";
    } else {
      throw new AppError(422,"analytics_claim_source_required","A stored evidence or external metric record is required.");
    }
    if(freshnessStatus!=="current") {
      throw new AppError(409,"analytics_claim_source_stale","Stale or unknown-freshness numerical evidence cannot be inserted into an outreach draft.");
    }
    const claimNumbers=numericTokens(input.claimText);
    const sourceNumbers=new Set(numericTokens(sourceText));
    if(claimNumbers.length===0 || claimNumbers.some((value)=>!sourceNumbers.has(value))) {
      throw new AppError(422,"analytics_claim_number_unsupported","Every numerical value in the draft claim must appear in the selected stored source.");
    }
    const id=newId();
    const result=await transaction.query<Record<string,unknown>>(
      `INSERT INTO outreach_analytics_claims
        (id,workspace_id,message_id,metric_code,claim_text,source_record_type,
         source_record_id,evidence_id,external_observation_id,period_starts_on,
         period_ends_on,freshness_at,freshness_status,selected_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'current',$13)
       RETURNING *`,[id,input.workspaceId,input.messageId,input.metricCode,input.claimText,
        input.sourceRecordType,input.sourceRecordId,input.evidenceId??null,
        input.externalObservationId??null,periodStarts,periodEnds,freshnessAt,input.userId]
    );
    await recordAudit(transaction,{workspaceId:input.workspaceId,actorUserId:input.userId,
      actorType:"user",action:"outreach.analytics_claim_selected",targetType:"outreach_message",
      targetId:input.messageId,origin:"api",requestId:input.requestId,outcome:"succeeded",
      metadata:{claimId:id,metricCode:input.metricCode,evidenceId:input.evidenceId??null,
        externalObservationId:input.externalObservationId??null,freshnessStatus}});
    return result.rows[0]!;
  });
}

export type FutureIntelligenceModelContract = {
  modelUseCase: "product_momentum"|"retail_readiness"|"business_fit"|"reorder_probability"|"commission_forecasting"|"relationship_health";
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  modelVersion: string;
  trainingDataLineage: Array<{dataset:string;version:string;permittedUse:string}>;
  evidenceRecordIds: string[];
  output: {classification:"model_inference";confidence:"insufficient"|"limited"|"supported"|"strong";explanation:string;limitations:string[]};
  reviewStatus: "generated"|"accepted"|"edited"|"rejected";
  monitoring: {driftReference:string;qualityReference:string;lastEvaluatedAt:string};
  rollback: {previousModelVersion:string;disableControl:string};
};
