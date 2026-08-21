// Conservative, standard security headers — this app handles internal governance documents
// (board papers, SMC submissions), so clickjacking/MIME-sniffing hardening matters even though
// it's an internal portal. Deliberately NOT including a Content-Security-Policy here: a real CSP
// needs to be built against this app's actual script/style sources and verified with a
// `next build && next start` smoke test, not guessed at in an audit pass — see
// docs/deployment-guide.md.
const securityHeaders = [
  // No legitimate reason for this app to be framed by another site or by itself.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop browsers from MIME-sniffing responses away from the declared Content-Type.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Send full referrer only to same-origin requests; cross-origin gets scheme+host+port only.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // This app doesn't use any of these browser features — deny them outright.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Ignored by browsers over plain HTTP, so harmless in local/dev; matters once this is served
  // over HTTPS in production. No `preload` — that's a separate, effectively irreversible opt-in
  // (submission to browsers' hardcoded preload list) that shouldn't be decided in a config audit.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
