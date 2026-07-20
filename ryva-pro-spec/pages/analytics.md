# Page: Analytics

## Purpose and user

Analyze Representative, Product, Brand, portfolio, pipeline, order, reorder, and commission performance with transparent metric definitions.

## Data displayed

Dashboard tabs: Representative Performance, Products, Brands, Portfolio Health, Pipeline/Forecast, Commissions. Metrics and rules follow `analytics-and-reporting.md`. Every chart shows period, currency, freshness, actual/estimate treatment, and definition.

## Actions

Primary: Select dashboard and period.  
Secondary: filter, inspect contributing records, save view, export, compare period, view metric definition.

## Filters

Period, Brand, Product, Business type, geography, stage, Account, actual/estimate, order/commission status.

## States

- **Empty:** distinguish no records from excluded filters; link source workflow.
- **Loading:** stable layout; last successful calculation.
- **Error:** partial dashboard labeled; no zero substitution.

## Permissions and responsive

Representative sees own workspace. Mobile provides summary and tables; dense exploration desktop-first.

## Linked records and AI

Drill-down to contributing records. AI may explain changes and anomalies with evidence; no causal claim without support.

## Acceptance criteria

- metric definitions and denominators accessible;
- estimates never combined with actual without explicit split;
- correction recomputes;
- no production intelligence score;
- charts accessible;
- export includes filters/definitions.

