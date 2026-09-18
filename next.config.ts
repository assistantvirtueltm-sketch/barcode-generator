import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aucun backend : l'app est entièrement rendue côté client et peut être
  // servie comme un site statique (Vercel ou n'importe quel CDN).
  output: "export",
};

export default nextConfig;
