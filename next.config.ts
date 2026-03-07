import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack 설정을 제거하여 파일 I/O 벤치마크 오류 해결
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.coingecko.com",
        pathname: "/coins/images/**",
      },
      {
        protocol: "https",
        hostname: "flagcdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "s3-symbol-logo.tradingview.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
