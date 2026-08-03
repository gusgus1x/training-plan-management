import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./app/Excel/*.xlsx"],
  },
};

export default nextConfig;
