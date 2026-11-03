import type { NextConfig } from "next";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // 서버 컴포넌트가 cookies()로 로그인 쿠키를 읽으면 cacheComponents 에서 에러가 난다. "use cache" 0건이라 끈다 (작업지시 C-2 1안)
  // cacheComponents: true,
  // partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // /api/v1/* 를 Spring 으로 넘긴다. 브라우저는 3000 하나만 보니 CORS 가 안 생기고 쿠키도 3000 에 붙는다. 로컬 개발 전용(운영은 Caddy)
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API_ORIGIN}/api/v1/:path*` }];
  },
};

export default nextConfig;
