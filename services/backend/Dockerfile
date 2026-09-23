FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY demo ./demo
# O1 norms from adilet.zan.kz (AGENTS.md §7a), loaded into Mongo at startup
COPY data ./data
# Tests ship in the image: docker compose run --rm --no-deps backend node --test
COPY test ./test
COPY scripts ./scripts
USER node
EXPOSE 8000
HEALTHCHECK --interval=5s --timeout=3s --retries=12 CMD wget -qO- http://127.0.0.1:8000/health || exit 1
CMD ["node", "src/server.js"]
