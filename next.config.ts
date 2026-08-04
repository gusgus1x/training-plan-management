import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.123.23.163"],
  outputFileTracingIncludes: {
    "/*": ["./app/Excel/*.xlsx"],
  },
};

export default nextConfig;
