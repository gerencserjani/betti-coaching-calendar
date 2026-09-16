FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma7.config.ts ./
COPY --from=build /app/package.json ./

# Cloud Run injects PORT (defaults to 8080) and expects the container to listen on it.
EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
