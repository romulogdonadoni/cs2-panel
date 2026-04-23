# Painel: Next.js + Prisma (Bun). A BD em runtime vem de DATABASE_URL (ex.: file:/data/panel.db).
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lock ./
# `postinstall` corre `prisma generate`; o schema tem de existir antes de `bun install`.
COPY prisma ./prisma
RUN bun install --frozen-lockfile
COPY . .
ENV DATABASE_URL="file:./prisma/build.db"
RUN bunx prisma generate
RUN bun run build
EXPOSE 3080
ENV NODE_ENV=production
ENV PORT=3080
CMD ["sh", "-c", "bunx prisma db push && exec bun run start"]
