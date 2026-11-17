/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.ENTCARE_NEXT_DIST_DIR ?? ".next",
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/models/:path*.glb",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
