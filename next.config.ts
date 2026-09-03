import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every address a teammate might type to reach this dev server. The Wi-Fi address is handed out
  // by DHCP, so it changes: when a colleague gets a blocked/blank page over the LAN, check
  // `ipconfig` on the host and add the current IPv4 address here.
  allowedDevOrigins: [
    "10.123.23.100",
    "10.123.23.163",
    "10.123.23.237",
    "10.123.23.38",
    "10.123.23.220",
    "172.20.10.4",
  ],
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
