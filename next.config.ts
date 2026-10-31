import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      { source: "/:path*", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "no-referrer" }
      ] },
      ...["/h/:path*", "/invite/:path*"].map(source => ({
        source,
        headers: [{ key: "Cache-Control", value: "no-store" }]
      }))
    ];
  }
};
export default nextConfig;
