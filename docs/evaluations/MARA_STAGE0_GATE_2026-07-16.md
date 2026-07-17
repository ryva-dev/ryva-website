# Mara Stage 0 gate evaluation — 2026-07-16

| Field | Value |
|---|---|
| Status | **Stage 0A FAIL — do not advance** |
| Environment | Production `ryvaforge.com` live office + local unit gates |
| Evaluator | Cursor agent |
| Commit under test (code) | `acd6fe07` (pushed; production may lag deploy) |

## Hard rule applied

Do not begin Stage 0B scoring as a pass, or Stage 1 infrastructure, until Stage 0A exits hold on the live product the creator sees.

## Stage 0A checklist (live office, 2026-07-16 evening)

| Exit | Live result | Evidence |
|---|---|---|
| Dream brands not overnight primary | **FAIL** | Deliverables + Today “Since you were away” lead with Gymshark market pulse |
| No placeholder pitches | **FAIL** | Follow-up + pitch template deliverables still show `[Your Name]`, `[Brand Name]`, `[SUBJECT_LINE_OPTION]` |
| No empty / fake market pulses as shipped | **FAIL** | “Creator market pulse” shipped with dream-brand focus and no usable opportunities |
| No “I shipped X” when X hidden/unusable | **FAIL** | History/Today still surface Gymshark pulse + Mad Libs as shipped; earlier digest ship claim without Deliverables row |
| Completed real work visible in Deliverables | **FAIL** | Library is mostly unusable templates / empty pulse; real commercial digest missing or mismatched |
| Honest blockers / intact Gmail UX | **PARTIAL** | Gmail reconnect banner is honest; Outlook overflow fix is in `acd6fe07` but not confirmed on prod until deploy |
| No calendar filler as Mara work | **FAIL** | Calendar still shows “approve … Gymshark…” / creator TikTok chores labeled as Mara |

### Local unit gates (code)

Pass: Stage 0 publication honesty, early-stage dream-brand gating, placeholder pitch rejection, Stage 0B rubric/70% harness (`maraStage0Quality`, `maraDeliverablePublication`, brand intelligence tests).

Local green ≠ live green until deploy + deliverable resync purge bad `office_deliverables` rows.

## Stage 0B — not started

Blocked by Stage 0A. Informal score of current visible “shipped” work against the 70% worth-pursuing rubric:

| Item | Worth pursuing? |
|---|---|
| Gymshark empty market pulse | No |
| Follow-up Mad Libs | No |
| Pitch template Mad Libs | No |

**Estimated pass rate: 0%** (well below 70%).

## Stage 1+ — not started

Blocked until Stage 0B exit holds.

## Required to re-test Stage 0A

1. Deploy `acd6fe07` (or later) to production.
2. Load office so `syncWorkerDeliverables` purges non-publishable rows (Mad Libs, empty pulses, legacy summary digests).
3. Confirm Today / Deliverables / desk no longer claim those as shipped.
4. Confirm Knowledge Gmail box has no overflowing Outlook button.
5. Re-run overnight autonomy; verify new outputs either appear in Deliverables or do not say “shipped.”

Only then mark Stage 0A PASS and open Stage 0B overnight scoring toward ≥70% worth-pursuing.
