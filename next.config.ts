import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.123.23.163", "10.123.23.237", "10.123.23.38", "10.123.23.220", "172.20.10.4"],
  outputFileTracingIncludes: {
    "/*": ["./app/Excel/*.xlsx"],
  },
  experimental: {
    // Turbopack's on-disk dev cache (.next/cache) has a known corruption bug — "Persisting
    // failed: Unable to write SST file... Compaction failed: Another write batch or compaction
    // is already active" — that recurs after an abrupt `next dev` termination (e.g. Windows
    // "Terminate batch job") and isn't fixed by deleting .next, since the cache re-corrupts on
    // the next abrupt stop. Disabling it trades a bit of rebuild speed for not crash-looping.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
