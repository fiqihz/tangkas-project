/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Route gambar hasil membaca font & logo lewat fs saat runtime. Pastikan
  // file-file itu ikut dibundel ke fungsi serverless di Vercel.
  outputFileTracingIncludes: {
    "/api/share-image": ["./asset/fonts/**/*", "./public/shuttlecock.png"],
  },
};

export default nextConfig;
