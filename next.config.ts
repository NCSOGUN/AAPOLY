import type { NextConfig } from "next";

const CORS_HEADERS = [
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Access-Control-Allow-Methods", value: "GET, POST, PATCH, DELETE, OPTIONS" },
  {
    key: "Access-Control-Allow-Headers",
    value: "Content-Type, Authorization, X-API-Key, X-Hospital-Token",
  },
  { key: "Access-Control-Max-Age", value: "86400" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/api/v1/:path*",    headers: CORS_HEADERS },
      { source: "/api/admin/:path*", headers: CORS_HEADERS },
    ];
  },
};

export default nextConfig;
