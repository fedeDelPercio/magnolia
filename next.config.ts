import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default de Next es 1MB y eso hacia que cualquier foto de telefono
      // (3-5MB tipico) abortara silenciosamente antes de llegar al server,
      // dejando el modal de comprobante OCR colgado en "parsing".
      // 20MB alcanza para fotos pesadas y PDFs escaneados sin abuso.
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
