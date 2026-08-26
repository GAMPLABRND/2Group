import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.*", "172.*", "192.168.*", "192.168.9.6"],
};

export default nextConfig;
