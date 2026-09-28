/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      // Default: deny framing everywhere
      { source: "/:path*", headers: securityHeaders },
      // Allow the projector display view to be embedded if needed
      {
        source: "/leaderboard",
        headers: securityHeaders.filter((h) => h.key !== "X-Frame-Options"),
      },
    ];
  },
};

module.exports = nextConfig;
