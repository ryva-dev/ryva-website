# Interaction and Motion

## Principle

Motion explains opening, closing, expansion, stage change, save, loading, confirmation, and state change. It never decorates or rewards.

## Timing

| Interaction | Duration | Behavior |
|---|---:|---|
| Hover/focus color | 120 ms | color/background only |
| Menu/popover | 120 ms | fade + 2 px translate |
| Tab content | 120 ms | fade; no directional slide |
| Drawer open | 180 ms | scrim fade + 16 px horizontal translate |
| Dialog open | 180 ms | fade + 4 px scale/translate |
| Expand/collapse | 180 ms | opacity + measured height |
| Stage movement | 240 ms max | move only after server-confirmed transition or optimistic state with guaranteed rollback |
| Save confirmation | 120 ms | local icon/text state, then stable label |
| Skeleton | none or subtle pulse | disabled under reduced motion |

Use the standard and exit easing tokens. No bounce, spring overshoot, parallax, confetti, or continuous animation.

## Feedback rules

- Button enters loading state immediately, retains label width, and prevents duplicate submit.
- Save success is local and may also emit a Toast.
- Server validation leaves the user’s content in place and identifies recovery.
- A visually moved Pipeline card reverts if the server rejects the transition and exposes the reason.
- Provider queueing is not shown as sent.
- Drawers and dialogs return focus to the invoker.
- Destructive completion changes the durable page state before any transient feedback disappears.

## Reduced motion

Under `prefers-reduced-motion: reduce`:

- transforms are removed;
- fades complete in 1–50 ms;
- stage changes update in place and announce text;
- skeleton pulse stops;
- scrolling uses instant behavior;
- focus and state indicators remain fully visible.

## Interaction acceptance criteria

- No routine interaction exceeds 240 ms.
- Motion never delays access to content or action.
- Every visual transition has a no-motion equivalent.
- Async state truth comes from the server and is audibly/visibly confirmed.
- No motion implies approval, success, delivery, payment, or authority before confirmation.

