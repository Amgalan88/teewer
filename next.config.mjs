/** @type {import('next').NextConfig} */
const nextConfig = {
  // тест/production build-ийг dev серверээс тусад нь хийх боломж (NEXT_DIST_DIR=.next-test)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // жингийн тасалбарын зураг (клиент талд шахсан) илгээхэд
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
