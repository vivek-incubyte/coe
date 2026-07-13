# Build stage
FROM node:22-alpine AS builder

WORKDIR /task-management

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

# Runtime stage
FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /task-management

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /task-management/dist ./dist

RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
USER nestjs

EXPOSE 3000

CMD ["node", "dist/src/main.js"]
