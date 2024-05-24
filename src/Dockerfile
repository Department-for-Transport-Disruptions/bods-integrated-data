FROM node:20-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.1.2 --activate
COPY pnpm-lock.yaml .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm fetch
COPY . .
RUN pnpm install --recursive --frozen-lockfile

FROM base AS build
WORKDIR /app
RUN pnpm --recursive run build

FROM node:20-alpine
WORKDIR /app

ARG servicePath

ENV NODE_ENV=production
COPY --from=build /app/tasks/${servicePath}/dist .

ENTRYPOINT ["node", "index.js"]