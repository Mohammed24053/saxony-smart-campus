# Accessibility audit — SEU Smart Campus

A snapshot of the WCAG AA / mobile a11y posture after the v1 redesign.

## Contrast (WCAG AA: 4.5:1 normal text, 3:1 large)

| Pair                             | Ratio | AA pass |
| -------------------------------- | ----- | ------- |
| `seu.navy` on `seu.cream`        | 11.0  | yes     |
| `seu.navy` on `white`            | 12.4  | yes     |
| `seu.gray` on `white` (subtext)  | 5.6   | yes     |
| `white` on `seu.red`             | 5.4   | yes (CTA) |
| `seu.navy` on `seu.gold` (badge) | 9.5   | yes     |
| `success` on `white`             | 5.0   | yes     |
| `danger` on `white`              | 5.4   | yes     |

Status: **all primary text/background pairs pass AA**.

## Focus & keyboard (web)

- Global `:focus-visible` ring: 2 px `seu.red` outline + 2 px offset.
- Every nav item, button, table row, dialog, and form field can receive
  keyboard focus and shows the ring.
- `<ConfirmModal>` traps focus within the dialog while open.
- Skip-link is **not** yet wired — tracked in §"Known gaps".

## Touch targets (mobile)

- Bottom nav tiles: `minHeight: 48 dp`, full-width tap area per item.
- Profile settings tiles: `ListTile` defaults exceed 48 dp.
- Auth OTP boxes: 44 × 50 dp each (passes 44 × 44 minimum).
- Floating "End lecture" CTA: 48 dp tall, full width.

## Reduce-motion

- Web: Framer Motion respects `prefers-reduced-motion: reduce` natively —
  page fades, count-ups, and toast drains gracefully degrade to instant
  state changes.
- Mobile: `flutter_animate` and the custom controllers do **not** auto-honour
  `MediaQuery.of(context).disableAnimations`. **Tracked gap** below.

## Internationalisation / RTL

- `MaterialApp.locale` is bound to `localeProvider` so the entire widget
  tree re-renders when the user toggles Profile → Language.
- Arabic locale loads the Cairo typeface via `google_fonts.cairoTextTheme()`.
- `Directionality` cascades automatically — all `Row` children flip
  start/end correctly.
- Schedule day chips, lecture cards, and notifications cards remain laid
  out horizontally in RTL; verified visually via local locale toggle in
  the design walkthrough.

## Known gaps (planned for v1.1)

- No skip-link on the admin shell yet.
- Reduced-motion plumbing for `flutter_animate` (wrap effects in a helper
  that no-ops when `MediaQuery.of(context).disableAnimations` is true).
- Charts (Recharts AreaChart, BarChart) are not yet keyboard-discoverable;
  consider `<table>` fallback summarising the data.
- Live attendance feed updates are not announced via `aria-live` —
  screen-reader users won't hear new student arrivals.

## Test checklist (manual)

Run before release:

- [ ] Tab through admin sidebar + every page; focus ring always visible.
- [ ] Use `aria-axe` browser extension on `/dashboard`, `/students`, `/attendance` — no critical violations.
- [ ] On mobile, enable iOS "Reduce Motion" / Android "Remove animations" —
      ensure nothing is broken (some animations will remain; tracked above).
- [ ] Toggle Arabic locale on mobile profile screen; verify every screen
      flips direction and the Cairo font is applied.
- [ ] On mobile, run the platform a11y inspector against the bottom nav —
      every tile announces its label and selected state.
