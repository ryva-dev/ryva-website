# Login

- **Route:** `/login`
- **Current purpose:** Authenticate and conditionally verify TOTP before access evaluation.
- **Audit issues:** Oversized marketing-style title; loaded/error focus context differs from authenticated pages; access outcome is only known after submit.
- **Pattern:** Settings and Administration — authentication variant.
- **Proposed layout:** Two-column at ≥1024 px: restrained Ryva context (40%) and centered 420 px form (60%); single form-first column below 768 px. No dashboard shell.
- **Primary action:** Sign in, changing to Verify after credentials require TOTP.
- **Secondary actions:** None unless an existing safe support/renewal link is available.
- **Hierarchy/sections:** Ryva identity → concise professional promise → form title/instruction → credentials or verification → eligibility note.
- **Timeline/right rail/filters/list:** None.
- **Dialogs/drawers:** None.
- **States:** Empty is the initial form; Loading keeps button width and announces authentication; Error is inline, safe, and linked to the relevant field; permission/restricted outcome redirects to Access; provider degradation gives a retry-safe message.
- **Permission/restricted states:** Login discloses no record permissions; server-determined certification/subscription/suspension/revocation outcomes redirect to Access without leaking account detail.
- **Mobile:** Form first, 16 px gutters, 44 px controls, no 42 vh marketing block.
- **Accessibility:** Correct autocomplete, labelled errors, focus on error summary/TOTP field, password manager compatibility, no credential-state disclosure.
- **Components:** Input, Button, Alert, LoadingState, PageHeader-like auth heading.
- **Consolidates/removes:** Current giant auth hero and independent error treatment; retains brand context.
- **Complexity:** Medium.
- **Acceptance criteria:** Existing login/TOTP/session behavior and rate limits pass; 320 px reflow; keyboard/password-manager journey passes; restricted users reach the same server-determined Access state.
