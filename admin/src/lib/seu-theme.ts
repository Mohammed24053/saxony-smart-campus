/**
 * SEU brand palette — exposed as plain hex strings so they can be passed to
 * libraries that don't read CSS custom properties (Recharts, canvas, inline
 * SVG attributes). Keep this in sync with `tailwind.config.ts` `seu.*` and
 * `globals.css` `:root`.
 */
export const SEU = {
  navy: '#31313B',
  red: '#B1222A',
  redHover: '#9d1d24',
  gold: '#E4BD4F',
  goldHover: '#cda737',
  cream: '#F3EDE4',
  gray: '#67666A',
  white: '#FFFFFF',
  status: {
    success: '#2E7D32',
    warning: '#E4BD4F',
    danger: '#B1222A',
    info: '#1976D2',
  },
} as const;

/** Recharts category palette in brand order. */
export const CHART_PALETTE = [
  SEU.red,
  SEU.gold,
  SEU.navy,
  SEU.status.info,
  SEU.status.success,
  SEU.gray,
];
