This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

docker build는 아래와 같이 진행.

docker build --build-arg API_ORIGIN=http://host.docker.internal:8080 -t oom-web:local .
docker run --rm -p 3000:3000 -e API_ORIGIN=http://host.docker.internal:8080 oom-web:local

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 로컬 개발 (실서버 연동 후)

1. 백엔드 먼저: 백엔드 레포에서 `make up → migrate → seed-reset → api → ai` (`deploy/.env` 필요). API는 `http://localhost:8080`.
2. `.env.local`에 `API_ORIGIN=http://localhost:8080` (기본값과 같음). 브라우저 요청은 `next.config.ts` rewrites가 `/api/v1/*`을 백엔드로 넘긴다 — 로컬 전용이고 운영은 Caddy가 받는다.
3. `npm install` 후 `npm run dev`. 시드 계정 `OOM0001~0005` / `Oom!demo-2026`.
4. **라우트를 지우거나 옮긴 뒤 `tsc`/빌드가 없는 파일(`app/api/mock/...`)을 가리키며 실패하면** `.next/` 캐시(`.next/dev/types/validator.ts`)가 옛 라우트를 기억하는 것이다. `.next/`를 지우고 다시 실행한다. 코드 문제가 아니다.
5. SSE가 `next dev`에서 한 번에 몰려오면 rewrite 버퍼링이다. `streamChat`만 `NEXT_PUBLIC_API_ORIGIN`으로 직결하고 백엔드 CORS(localhost:3000, credentials)를 켠다. 운영은 해당 없음.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
