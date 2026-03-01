import type { NextConfig } from "next";

const apiOrigin = (process.env.KINETOGRAPH_API_ORIGIN || "http://localhost:8080").replace(
	/\/$/,
	"",
);

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "500mb",
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
