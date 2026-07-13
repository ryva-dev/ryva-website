# Mara paid-stranger soak checklist

Do **not** claim Mara is polished for paying strangers until this passes on a real Postgres + S3 deploy with Stripe webhooks live.

## Preflight (ops)

- [ ] Production boot succeeds with Stripe + webhook secret, Google OAuth, SMTP, Postgres, S3, Anthropic
- [ ] Video QA: either `MARA_DISABLE_VIDEO_QA=1` **or** OpenAI Whisper + Anthropic multimodal + `MARA_REQUIRE_REAL_MEDIA=1`
- [ ] `SUPPORT_EMAIL` reaches a human
- [ ] Homepage/legal claims match Gmail + approval-gated sends (no fake Slack/Notion/IG connect)
- [ ] Optional senses documented if advertised: Meta / TikTok / Hunter / Apollo

## Stranger path (48h)

1. **Fresh account** — signup (Google or email verify) → complete account onboarding
2. **Pay** — hire Mara via Stripe Checkout → wait for hire activation (client polls `/api/payments/hire-status`) → land in Mara onboarding
3. **Setup** — finish Mara interview → connect Gmail from setup checklist / Knowledge → confirm permissions
4. **Leave running** — do not babysit for ~48 hours (autonomy interval active)
5. **Return** — Today shows money moves / send approvals / stalled deals (or honest empty state)
6. **One commercial loop** — research → contact (or confirm inferred) → draft → approve send → reply/stage advance (staged reply OK for soak)

## Pass criteria

- [ ] No checkout→empty-office race (hire present before onboarding)
- [ ] No mock creative QA presented as real
- [ ] No invented ads when Meta/TikTok keys missing
- [ ] Approve send works from Today **and** Reviews
- [ ] Support email works

## Fail → fix → re-soak

Only fix soak failures. Do not expand scope into market-crush features until this bar is green.
