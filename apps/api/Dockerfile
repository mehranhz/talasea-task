FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api apps/api
COPY packages/types packages/types
RUN pnpm --filter @talasea/types build \
  && pnpm --filter api build \
  && pnpm --filter api deploy --prod /out \
  && cp -r apps/api/dist /out/dist

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out ./
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
