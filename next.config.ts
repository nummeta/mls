import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // ここで上限サイズを指定（動画なら大きめに 500MB とか 1GB にしておく）
      bodySizeLimit: '500mb',
    },
  },
};

export default nextConfig;
