import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // (Cloudflare deployment doesn't need any special bundler config now that
  // snowflake-sdk has been replaced by a fetch-based REST client.)
}

export default nextConfig
