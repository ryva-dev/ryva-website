# Phase 5 Outreach Center

Phase 5 adds human-controlled email, social, call, template, sequence, task,
response, and suppression workflows. Every external action reuses the Phase 4
authority validator at approval and execution time.

## Delivery setup

Configure `EMAIL_PROVIDER_URL=https://api.resend.com`, `EMAIL_PROVIDER_TOKEN`,
`RESEND_WEBHOOK_SECRET`, and `EMAIL_FROM_ADDRESS`. Keep
`OUTREACH_SEND_ENABLED=0` until commercial outreach is explicitly approved;
transactional identity email uses its separate configuration and remains
available. Run the API and durable worker separately:

```sh
npm run start
npm run start:worker
```

The internal provider contract receives an idempotency key, sender, recipient,
subject, body, and safe headers. The Resend adapter translates that request to
`POST /emails` and translates the provider response back to:

```json
{"status":"accepted","providerMessageId":"provider-id"}
```

Retryable failures preserve the same idempotency key. They never create a
second Email or advance a Placement. The Resend callback uses
`POST /api/webhooks/email/resend`, with the provider's Svix signature over the
raw body. Subscribed events are `email.delivered`, `email.bounced`, and
`email.complained`. Reply, opt-out, and accepted callbacks are not inferred:
acceptance comes from the synchronous send response, and Resend does not
provide a reliable originating-message mapping for the other two normalized
states. The legacy normalized callback remains available at
`POST /api/webhooks/email` for provider-agnostic gateway integrations.

## Operational boundaries

- Drafts, templates, and sequences never authorize a send.
- Material edits invalidate approval.
- Email is Contacted only after provider acceptance.
- Social outreach requires exact approval plus a human send confirmation.
- Calls are placed by humans and then logged.
- Reply, opt-out, complaint, hard bounce, invalid authority, access restriction,
  and unresolved conflicts suppress due work.
- Binding negotiation, Orders, Accounts, and Reorders remain Phase 6.
