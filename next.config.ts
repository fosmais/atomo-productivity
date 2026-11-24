import type { NextConfig } from "next";

if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "release/myryra-mvp2-final-20261123") {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://xanavauqzsrgvdfhcrsm.supabase.co") {
    throw new Error("MVP2 release preview requires the isolated homologation database.");
  }
}

const nextConfig: NextConfig = {
  devIndicators: false,
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
