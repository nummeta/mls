import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Zoom SDKはReact Strict Modeと相性が悪いため false に設定
  reactStrictMode: false,

  // 既存の設定（動画アップロードサイズ上限など）
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },

  // Zoom Web SDKの高度な機能（ギャラリービュー等）に必要なセキュリティヘッダー
  // async headers() {
  //   return [
  //     {
  //       source: '/(.*)',
  //       headers: [
  //         {
  //           key: 'Cross-Origin-Embedder-Policy',
  //           value: 'require-corp',
  //         },
  //         {
  //           key: 'Cross-Origin-Opener-Policy',
  //           value: 'same-origin',
  //         },
  //       ],
  //     },
  //   ];
  // },
};

export default nextConfig;