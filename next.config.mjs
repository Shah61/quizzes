/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Media is hotlinked straight from the source CDNs, so plain <img> is used
  // throughout and Next's image optimiser is not involved.
};
export default nextConfig;
