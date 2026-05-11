# SEU Smart Campus — Design System

The visual identity of Saxony Egypt University Smart Campus, applied
consistently across the **admin dashboard** (Next.js + Tailwind + Framer
Motion) and the **mobile app** (Flutter + flutter_animate).

> Live preview: open the admin dashboard and visit
> [`/design-system`](http://localhost:3001/design-system). For the mobile
> app, every primitive lives under
> [`mobile/lib/widgets/seu/`](../mobile/lib/widgets/seu/).

## 1. Brand colours

Sourced from the official SEU shield logo. Use the named tokens — never
hard-code hexes.

| Token        | Hex       | Usage                                       |
| ------------ | --------- | ------------------------------------------- |
| `seu.navy`   | `#31313B` | Sidebar, app bars, dark surfaces, headlines |
| `seu.red`    | `#B1222A` | Primary CTA, FAB, danger accents            |
| `seu.gold`   | `#E4BD4F` | Highlights, badges, KPI top border          |
| `seu.cream`  | `#F3EDE4` | Page background                             |
| `seu.gray`   | `#67666A` | Subtext, inactive states                    |
| `seu.white`  | `#FFFFFF` | Cards, inputs                               |
| `success`    | `#2E7D32` | Present, online                             |
| `warning`    | `#E4BD4F` | Late, warning_1                             |
| `danger`     | `#B1222A` | Absent, deprivation                         |
| `info`       | `#1976D2` | Informational accents, links                |

Tailwind config: <ref_file file="admin/tailwind.config.ts" />
Flutter tokens: `mobile/lib/theme/app_theme.dart` (`SeuColors`).

## 2. Typography

| Surface       | Family   | Notes                                    |
| ------------- | -------- | ---------------------------------------- |
| Admin (web)   | Inter    | Variable, applied via `next/font/google` |
| Mobile (en)   | Poppins  | `google_fonts` package                   |
| Mobile (ar)   | Cairo    | Auto-applied for `Locale('ar')`          |

Headline scale: 32 / 28 / 24 / 20 / 18 / 16 / 14. Body: 16 / 14. Caption: 12.

## 3. Border radii

| Token | Value | Used for                |
| ----- | ----- | ----------------------- |
| `sm`  | 6 px  | Skeleton lines, dividers |
| `md`  | 10 px | Buttons, inputs         |
| `lg`  | 16 px | Cards, panels           |
| `xl`  | 20 px | Modals, pills           |

## 4. Shadows

| Token         | Value                                          |
| ------------- | ---------------------------------------------- |
| `card`        | `0 2px 16px rgba(49,49,59,0.08)`               |
| `modal`       | `0 8px 40px rgba(49,49,59,0.18)`               |
| `btn-hover`   | `0 4px 16px rgba(177,34,42,0.28)` (red glow)   |

## 5. Animation tokens

Motion is purposeful, not decorative. All durations and curves are tracked
identically on web (`admin/src/lib/seu-theme.ts`) and mobile
(`mobile/lib/theme/app_theme.dart` → `SeuMotion`).

| Animation                | Duration | Easing               | Where used                       |
| ------------------------ | -------- | -------------------- | -------------------------------- |
| Page fade-up enter       | 300 ms   | ease-out cubic       | All admin route transitions      |
| Sidebar active-bar slide | 150 ms   | spring (380 / 28)    | Admin sidebar nav                |
| KPI count-up             | 1200 ms  | ease-out             | KPI cards (web), live counter    |
| Table row stagger        | 20 ms/row | linear              | Admin data tables                |
| Modal scale-in           | 250 ms   | spring (0.92 → 1)    | Confirm modals (web + mobile)    |
| Skeleton shimmer         | 1500 ms  | linear loop          | All async content                |
| Toast slide-in / drain   | 300 ms / 4 s | ease-out / linear | Top-right toasts (web)         |
| Button press scale       | 150 ms   | ease-out             | All primary buttons              |
| Splash logo entrance     | 700 ms   | elastic-out          | Mobile splash screen             |
| Splash particle burst    | 900 ms   | ease-out cubic       | Mobile splash CustomPainter      |
| Bottom nav icon bounce   | 320 ms   | ease-out             | Mobile bottom nav                |
| Lecture row entrance     | 260 ms   | ease-out cubic       | Mobile schedule + home           |
| Live counter flip        | 280 ms   | ease-out / in cubic  | Doctor active session            |
| QR scanner draw-in       | 700 ms   | ease-out cubic       | Mobile scan screen corners       |
| QR scanner sweep beam    | 1500 ms  | linear loop          | Mobile scan screen overlay       |
| Attendance ring sweep    | 800 ms   | ease-out cubic       | Attendance history rings         |
| Result overlay icon pop  | 300 ms   | spring (0.4 → 1)     | Scan success / failure overlays  |
| Shake on error           | 400 ms   | ±8 px @ 6 Hz         | Login on bad credentials         |

## 6. Reusable primitives

### Web (`admin/src/components/seu/`)

- `<KPICard>` — `AnimatedNumber` count-up + optional live dot / danger badge.
- `<KPIRow>` — staggers child KPI cards 50 ms apart.
- `<AttendanceChart>` — Recharts `AreaChart` with brand red gradient fill.
- `<StatusBadge>` — CVA-driven tone variants (present / late / absent /
  warning_1 / warning_2 / deprivation / info / neutral).
- `<Skeleton>` + `<KPISkeleton>` / `<TableSkeleton>` — shimmer placeholders.
- `<NotificationToast>` (`<ToastProvider>` + `useToast()`) — auto-dismissing
  toasts with progress drain.
- `<ConfirmModal>` — danger-aware confirm dialog with spring entrance.
- `<FileUploadZone>` — drag-and-drop upload zone with progress fill.
- `<FlipCounter>` — per-digit flip counter.
- `<PageEnter>` / `<PageHeader>` — page-level fade-up wrapper.

### Mobile (`mobile/lib/widgets/seu/`)

- `LectureCard` — left accent bar, `Current` pulse, time/room/doctor.
- `AttendanceRing` — animated circular percent.
- `LiveCounter` — flip digits (matches `<FlipCounter>` on web).
- `StatusChip` — tone-aware pill (matches `<StatusBadge>` on web).
- `QrDisplayWidget` — rotating QR + countdown ring.
- `OfflineBanner` — sticky amber banner driven by `connectivity_plus`.
- `SeuBottomNav` — bouncy active icon + gold dot.

## 7. Accessibility

- All text/background pairs meet **WCAG AA contrast** (verified against
  `seu.navy / cream`, `seu.red / white`, etc.).
- Web: focus rings visible on every interactive element via `focus-visible`
  utilities; `:focus-visible` has a 2 px red outline + 2 px offset.
- Mobile: every tap target is ≥ 44 dp; `Semantics` is set on bottom nav tiles
  with `selected` and `button` flags.
- Reduce-motion: web honours `prefers-reduced-motion` (Framer Motion's
  built-in support); mobile uses platform-level `MediaQuery.of(context)
  .disableAnimations` which Flutter wires automatically when accessibility
  settings disable animations.
- RTL: switched globally via `LocaleNotifier.toggle()`. Cairo font auto-loads
  for Arabic locale; the `MaterialApp.locale` change cascades through every
  `Directionality` consumer.

## 8. Layout & spacing

4-px grid: `xs=4`, `sm=8`, `md=12`, `lg=16`, `xl=24`, `xxl=32`. Mobile uses
`SeuSpacing.*`; web uses Tailwind's default 4-px scale.

Admin breakpoints (Tailwind defaults): `sm 640`, `md 768`, `lg 1024`,
`xl 1280`, `2xl 1536`. Sidebar collapses to a 64-px icon rail at < `lg`.

Mobile is mobile-first; landscape support is best-effort (lecture lists
remain a single column; QR screens centre the frame in the larger viewport).
