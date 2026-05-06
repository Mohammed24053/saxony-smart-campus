/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// API origin we connect to from the browser. Pulled from runtime env so
// preview / production deploys can target different backends without a
// rebuild.
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3000";

// Build a CSP that locks down what scripts / styles / assets the admin can
// load. We allow `'unsafe-inline'` on styles (Tailwind injects them) and
// `'unsafe-eval'` only in dev (Next.js dev overlay needs it). In production
// we keep `script-src` strict.
function buildCsp() {
  const apiOrigin = (() => {
    try {
      return new URL(apiUrl).origin;
    } catch {
      return "http://localhost:3000";
    }
  })();
  const socketOrigin = (() => {
    try {
      return new URL(socketUrl).origin;
    } catch {
      return "http://localhost:3000";
    }
  })();
  const scriptSrc = isDev ? "'self' 'unsafe-eval' 'unsafe-inline'" : "'self'";
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${apiOrigin} ${socketOrigin} ws: wss:`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildCsp() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
];

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_SOCKET_URL: socketUrl,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
