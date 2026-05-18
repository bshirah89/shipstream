/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for SSE streaming responses — disables response buffering
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

module.exports = nextConfig;
