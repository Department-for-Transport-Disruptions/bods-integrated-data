FROM node:20-alpine AS base
WORKDIR /app
ARG servicePath

RUN corepack enable && corepack prepare pnpm@9.1.2 --activate

COPY pnpm-lock.yaml .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm fetch
COPY . .
RUN pnpm install --filter bods-integrated-data --filter @bods-integrated-data/${servicePath}-task --filter @bods-integrated-data/shared --frozen-lockfile

FROM base AS build
ARG servicePath

WORKDIR /app
RUN pnpm --filter @bods-integrated-data/${servicePath}-task run build

FROM node:20-alpine
WORKDIR /app

ARG servicePath

ENV NODE_ENV=production
COPY --from=build /app/tasks/${servicePath}/dist .

RUN if [[ ${servicePath} == "siri-vm-generator" ]] ; then apk add bash libxml2-utils ; else : ; fi

EXPOSE 8080

ENTRYPOINT ["node", "index.js"]
