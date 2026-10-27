FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile --filter web...
COPY apps/web apps/web
COPY packages/ui packages/ui
COPY packages/types packages/types
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @talasea/types build \
  && pnpm --filter web build

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3001
CMD ["node", "apps/web/server.js"]
