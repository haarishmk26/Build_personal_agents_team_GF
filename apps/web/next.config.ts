import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@life-agent/core", "@life-agent/agentmail", "@life-agent/mock-sites"]
};

export default nextConfig;