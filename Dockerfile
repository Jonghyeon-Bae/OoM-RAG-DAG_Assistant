# 프론트 운영 이미지 (백엔드 요청 F — 11/07 전달 §3.4). 백엔드 deploy/docker-compose.prod.yml 의 WEB_IMAGE 로 쓴다.
# 빌드:  docker build -t oom-web .
# 런타임 env(운영 compose 가 넣음): HOSTNAME=0.0.0.0 PORT=3000 API_ORIGIN=http://api:8080 — 서버 컴포넌트(lib/api/server.ts)가 실행 때 읽는다
# 빌드 때 박히는 값 두 개(build-arg 로만 바꾼다):
#   NEXT_PUBLIC_API_BASE  브라우저가 부르는 경로. 기본 /api/v1 (Caddy 와 같은 오리진)
#   API_ORIGIN            next.config.ts rewrites 의 목적지. rewrites 는 빌드 때 routes-manifest 에 고정된다(실행 때 -e 로 못 바꿈, #092)
#                         운영은 Caddy 가 /api/v1 을 api 로 먼저 보내 이 값에 닿지 않는다 → 기본값 그대로 둔다
# Caddy 없이 이미지 하나만 띄워 로그인까지 확인하려면 (로컬 전용 이미지):
#   docker build --build-arg API_ORIGIN=http://host.docker.internal:8080 -t oom-web:local .
#   docker run --rm -p 3000:3000 -e API_ORIGIN=http://host.docker.internal:8080 oom-web:local
# 운영과 같은 구성(Caddy → web/api)은 백엔드 deploy/docker-compose.smoke.yml + smoke.sh 로 확인한다

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE=/api/v1
ARG API_ORIGIN=http://localhost:8080
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE \
    API_ORIGIN=$API_ORIGIN \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
