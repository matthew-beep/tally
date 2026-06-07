import type { NextConfig } from 'next'

const config: NextConfig = {
  // Allow dev server access from LAN IP (e.g. phone on same Wi‑Fi)
  allowedDevOrigins: ['192.168.0.100'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
}

export default config
