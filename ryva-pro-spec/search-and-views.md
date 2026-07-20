# Search and Views

## Global search

Search across:

- Products;
- Brands;
- Businesses;
- Contacts;
- Placement Opportunities;
- accounts;
- orders;
- commissions;
- notes;
- documents and metadata.

## Search behavior

- command-bar access from every page;
- typeahead grouped by record type;
- exact identifiers before fuzzy name matches;
- typo tolerance through trigram similarity;
- filter by owner, status, date, Brand, Product, Business, and record type;
- permissions applied before ranking;
- archived results hidden by default;
- recent searches local to user;
- snippets avoid exposing restricted content.

AI semantic search is excluded initially. Postgres full-text/trigram search is sufficient and explainable.

## Views

Supported:

- table;
- list;
- Kanban;
- calendar;
- dashboard;
- comparison;
- map/geographic view for Businesses where useful and data is adequate.

## Saved views

A view stores:

- record type;
- filters;
- sort;
- visible columns and order;
- grouping;
- density;
- date/currency settings;
- owner and private/workspace scope.

First version workspaces are personal, so shared views are reserved for future team use. Ryva-supplied views are read-only templates that users may duplicate.

## Filter grammar

AND between filter groups, explicit OR within one field group. Filters show human-readable chips. No arbitrary query language.

## Table behavior

- pinned identity column;
- column chooser and resize;
- server-side sort/filter/pagination;
- bulk select across current result only unless “all matching” explicitly confirmed;
- row quick actions;
- record drawer;
- export current permitted result;
- status and evidence indicators accessible without color.

## Comparison

Products: up to four records, aligned fields, evidence freshness, unknowns, risks, qualification, no production score.  
Brands: up to four records for internal diligence.  
Business Fit comparisons remain Opportunity-contextual and are not a generic Business ranking.

## Map view

Optional Business view using address/geocode with clustering and filters. Do not infer territory, customer demographics, or demand from location alone. List/table alternative required.

## Empty and error

Empty views distinguish no records, no filter matches, and unavailable provider data. Errors preserve filters and allow retry; partial results are labeled.

