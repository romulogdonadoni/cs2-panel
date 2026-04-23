import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "raw.githubusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "steamcdn-a.akamaihd.net", pathname: "/**" },
      { protocol: "https", hostname: "community.cloudflare.steamstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "avatars.steamstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "avatar.akamaized.net", pathname: "/**" },
    ],
  },
};

export default nextConfig;
