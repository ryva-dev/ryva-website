# Phase 5 Outreach Center

Phase 5 adds human-controlled email, social, call, template, sequence, task,
response, and suppression workflows. Every external action reuses the Phase 4
authority validator at approval and execution time.

## Delivery setup

Configure `EMAIL_PROVIDER_URL`, `EMAIL_PROVIDER_TOKEN`,
`EMAIL_WEBHOOK_SECRET`, and `EMAIL_FROM_ADDRESS`, then set
`OUTREACH_SEND_ENABLED=1`. Run the API and durable worker separately:

```sh
npm run start
npm run start:worker
```

The provider `POST /messages` contract receives an idempotency key, sender,
recipient, subject, body, and safe headers. It returns:

```json
{"status":"accepted","providerMessageId":"provider-id"}
```

`uncertain` results retry with the same idempotency key. They never create a
second Email or advance a Placement. Provider callbacks use
`POST /api/webhooks/email` with the raw-body HMAC SHA-256 in
`x-ryva-signature`. Supported events are `accepted`, `delivered`, `bounced`,
`complained`, `replied`, and `opted_out`.

## Operational boundaries

- Drafts, templates, and sequences never authorize a send.
- Material edits invalidate approval.
- Email is Contacted only after provider acceptance.
- Social outreach requires exact approval plus a human send confirmation.
- Calls are placed by humans and then logged.
- Reply, opt-out, complaint, hard bounce, invalid authority, access restriction,
  and unresolved conflicts suppress due work.
- Binding negotiation, Orders, Accounts, and Reorders remain Phase 6.
