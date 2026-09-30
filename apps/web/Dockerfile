# Web (Next.js). Contexto de build: raíz del repositorio.
#   docker build -f apps/web/Dockerfile -t poster-web .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/themes/package.json packages/themes/
RUN pnpm install --frozen-lockfile --filter @poster/web...
COPY packages/themes packages/themes
COPY apps/web apps/web
RUN pnpm --filter @poster/web build
# Esta etapa también sirve para migraciones y seed: `pnpm --filter @poster/web db:migrate`

FROM node:22-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN useradd --uid 1001 --create-home nextjs && mkdir -p /data/files && chown nextjs /data/files
COPY --from=builder --chown=nextjs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs /repo/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["node", "server.js"]
