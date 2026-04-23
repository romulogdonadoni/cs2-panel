FROM oven/bun:1.2-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
EXPOSE 3080
# Mantém user root para poder escrever .env no volume /project
CMD ["bun", "run", "start"]
