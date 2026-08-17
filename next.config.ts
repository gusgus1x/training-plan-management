import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.123.23.163", "10.123.23.237", "10.123.23.38", "10.123.23.220", "172.20.10.4"],
  outputFileTracingIncludes: {
    "/*": ["./app/Excel/*.xlsx"],
  },
};

export default nextConfig;
